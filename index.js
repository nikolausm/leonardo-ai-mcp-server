import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leonardo AI API configuration
const API_BASE = 'https://cloud.leonardo.ai/api/rest/v1';
const API_KEY = process.env.LEONARDO_API_KEY;

// Available models
const MODELS = {
  'leonardo-diffusion-xl': '6bef9f1b-29cb-40c7-b9df-32b51c1f67d3',
  'leonardo-vision-xl': 'e316348f-7773-490e-adcd-46757c738eb7',
  'leonardo-anime-xl': 'aa77f04e-3eec-4034-9c07-d0f619684628',
  'dreamshaper-v7': 'ac614f96-1082-45bf-be9d-757f2d31c174',
  'realistic-vision-v5': 'b820ea11-02bf-4652-97ae-9ac0cc00593d'
};

const server = new Server({
  name: 'leonardo-ai-mcp-server',
  description: 'Access Leonardo AI for free AI image generation (150 daily credits)',
  version: '1.0.0'
}, { capabilities: { tools: {} } });

const tools = [];

// Tool to generate images
tools.push({
  name: 'generate_image',
  description: 'Generate an image using Leonardo AI',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Text prompt describing the image to generate'
      },
      model: {
        type: 'string',
        enum: Object.keys(MODELS),
        description: 'Model to use for generation',
        default: 'leonardo-diffusion-xl'
      },
      negative_prompt: {
        type: 'string',
        description: 'What to avoid in the image'
      },
      num_images: {
        type: 'integer',
        description: 'Number of images to generate (1-4)',
        default: 1,
        minimum: 1,
        maximum: 4
      },
      width: {
        type: 'integer',
        description: 'Image width (multiple of 8)',
        default: 512
      },
      height: {
        type: 'integer',
        description: 'Image height (multiple of 8)',
        default: 512
      },
      guidance_scale: {
        type: 'number',
        description: 'How closely to follow the prompt (1-20)',
        default: 7
      },
      save_path: {
        type: 'string',
        description: 'Path to save the generated image(s)'
      }
    },
    required: ['prompt']
  },
  handler: async (args) => {
    try {
      if (!API_KEY) {
        throw new Error('LEONARDO_API_KEY environment variable not set');
      }

      // Create generation
      const modelId = MODELS[args.model || 'leonardo-diffusion-xl'];
      const createResponse = await fetch(`${API_BASE}/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: args.prompt,
          negative_prompt: args.negative_prompt,
          modelId: modelId,
          width: args.width || 512,
          height: args.height || 512,
          num_images: args.num_images || 1,
          guidance_scale: args.guidance_scale || 7,
          public: false
        })
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`API error: ${error}`);
      }

      const { sdGenerationJob } = await createResponse.json();
      const generationId = sdGenerationJob.generationId;

      // Poll for completion
      let generation;
      let attempts = 0;
      const maxAttempts = 60; // 1 minute timeout

      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`${API_BASE}/generations/${generationId}`, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`
          }
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to check generation status');
        }

        generation = await statusResponse.json();
        
        if (generation.generations_by_pk.status === 'COMPLETE') {
          break;
        } else if (generation.generations_by_pk.status === 'FAILED') {
          throw new Error('Generation failed');
        }

        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Generation timed out');
      }

      // Get generated images
      const images = generation.generations_by_pk.generated_images;
      const results = [];

      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i].url;
        
        if (args.save_path) {
          // Download and save image
          const response = await fetch(imageUrl);
          const buffer = await response.buffer();
          
          const filename = images.length > 1 
            ? `${args.save_path.replace(/\.[^/.]+$/, '')}_${i + 1}${path.extname(args.save_path) || '.png'}`
            : args.save_path;
          
          await fs.writeFile(filename, buffer);
          results.push({
            id: images[i].id,
            url: imageUrl,
            saved_to: filename
          });
        } else {
          results.push({
            id: images[i].id,
            url: imageUrl
          });
        }
      }

      return {
        success: true,
        generation_id: generationId,
        model: args.model || 'leonardo-diffusion-xl',
        images: results,
        credits_used: images.length * 2 // Approximate credit usage
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// Tool to check user info and credits
tools.push({
  name: 'check_credits',
  description: 'Check your Leonardo AI account and remaining credits',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async () => {
    try {
      if (!API_KEY) {
        return {
          status: 'error',
          message: 'LEONARDO_API_KEY not configured'
        };
      }

      const response = await fetch(`${API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      if (!response.ok) {
        return {
          status: 'error',
          message: 'Failed to fetch user info'
        };
      }

      const data = await response.json();
      return {
        status: 'active',
        username: data.user_details[0].username,
        credits_remaining: data.user_details[0].apiConcurrencySlots,
        daily_credits: 150,
        message: 'Leonardo AI provides 150 free credits daily'
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
});

// Tool to list available models
tools.push({
  name: 'list_models',
  description: 'List available Leonardo AI models',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async () => {
    return {
      models: Object.entries(MODELS).map(([key, value]) => ({
        key,
        model_id: value,
        description: getModelDescription(key)
      }))
    };
  }
});

function getModelDescription(modelKey) {
  const descriptions = {
    'leonardo-diffusion-xl': 'High-quality general purpose model',
    'leonardo-vision-xl': 'Photorealistic and artistic styles',
    'leonardo-anime-xl': 'Anime and manga style images',
    'dreamshaper-v7': 'Fantasy and dreamlike images',
    'realistic-vision-v5': 'Highly realistic photographs'
  };
  return descriptions[modelKey] || 'AI image generation model';
}

const validator = new AjvJsonSchemaValidator();
const validators = new Map(tools.map(tool => [tool.name, validator.getValidator(tool.inputSchema)]));

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ handler, ...definition }) => definition)
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  const tool = tools.find(tool => tool.name === request.params.name);
  if (!tool) throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${request.params.name}`);
  const args = request.params.arguments ?? {};
  const validation = validators.get(tool.name)(args);
  if (!validation.valid) throw new McpError(ErrorCode.InvalidParams, validation.errorMessage);
  const result = await tool.handler(args);
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    ...(result.success === false || result.status === 'error' ? { isError: true } : {})
  };
});

// Start the server
async function start() {
  console.error('Starting Leonardo AI MCP server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Leonardo AI MCP server running');
}

start().catch(console.error);
