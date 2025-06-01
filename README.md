# Leonardo AI MCP Server

An MCP (Model Context Protocol) server that provides access to Leonardo AI's image generation API with 150 free daily credits.

## Features

- Generate high-quality images using various AI models
- 150 free credits daily (refreshes at midnight)
- Support for multiple art styles and models
- Batch generation (1-4 images at once)
- Save images locally or get URLs
- Check remaining credits

## Available Models

- **Leonardo Diffusion XL**: High-quality general purpose model
- **Leonardo Vision XL**: Photorealistic and artistic styles
- **Leonardo Anime XL**: Anime and manga style images
- **DreamShaper v7**: Fantasy and dreamlike images
- **Realistic Vision v5**: Highly realistic photographs

## Installation

1. Clone this repository:
```bash
git clone https://github.com/nikolausm/leonardo-ai-mcp-server.git
cd leonardo-ai-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Get your Leonardo AI API key:
   - Sign up at https://leonardo.ai (free)
   - Go to API settings
   - Generate an API key
   - Copy the key

4. Set up environment variable:
```bash
export LEONARDO_API_KEY="your_api_key_here"
```

## Configuration in Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "leonardo-ai": {
      "command": "node",
      "args": ["/path/to/leonardo-ai-mcp-server/index.js"],
      "env": {
        "LEONARDO_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage

### Generate an Image

```javascript
// Basic usage
generate_image({
  prompt: "a majestic castle on a hilltop at sunset"
})

// Advanced usage
generate_image({
  prompt: "cute cartoon guinea pig with big eyes",
  model: "leonardo-anime-xl",
  negative_prompt: "realistic, scary, dark",
  num_images: 2,
  width: 768,
  height: 768,
  guidance_scale: 10,
  save_path: "/tmp/guinea_pig.png"
})
```

### Check Remaining Credits

```javascript
check_credits()
```

### List Available Models

```javascript
list_models()
```

## Free Credits System

- **150 credits daily** (resets at midnight UTC)
- Each image costs approximately 2 credits
- That's about 75 images per day for free!
- No credit card required

## Tips for Better Results

1. **Use specific models**:
   - `leonardo-anime-xl` for anime/cartoon style
   - `realistic-vision-v5` for photorealistic images
   - `dreamshaper-v7` for fantasy art

2. **Optimize dimensions**:
   - Use multiples of 8 (512, 768, 1024)
   - Square images often work best

3. **Negative prompts are powerful**:
   - Use them to avoid unwanted elements
   - Example: "blurry, low quality, distorted"

## Examples

### Children's Book Illustration
```javascript
generate_image({
  prompt: "friendly guinea pig reading a book, children's illustration, soft pastel colors",
  model: "leonardo-diffusion-xl",
  negative_prompt: "realistic, dark, scary",
  width: 768,
  height: 768
})
```

### Educational Poster
```javascript
generate_image({
  prompt: "educational poster showing guinea pig care, clean design, infographic style",
  model: "leonardo-vision-xl",
  num_images: 3,
  guidance_scale: 12
})
```

## Error Handling

The server handles common errors:
- Invalid API key
- Insufficient credits
- Generation failures
- Timeout issues

## License

MIT

## Author

Michael Nikolaus

## Links

- [Leonardo AI](https://leonardo.ai)
- [API Documentation](https://docs.leonardo.ai)