import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const loader = fileURLToPath(new URL('./mock-loader.mjs', import.meta.url));

async function withServer(run, key = 'synthetic-test-key') {
  const client = new Client({ name: 'leonardo-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--experimental-loader', loader, 'index.js'],
    cwd: root,
    env: { PATH: process.env.PATH, LEONARDO_API_KEY: key },
    stderr: 'pipe'
  });
  try {
    await client.connect(transport);
    await run(client);
  } finally {
    await client.close();
  }
}

test('stdio initializes, lists tools and dispatches all handlers without live calls', { timeout: 10000 }, async () => {
  await withServer(async client => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), ['generate_image', 'check_credits', 'list_models']);
    assert.ok(tools.every(tool => !Object.hasOwn(tool, 'handler')));
    const models = await client.callTool({ name: 'list_models' });
    assert.equal(JSON.parse(models.content[0].text).models.length, 5);
    const account = await client.callTool({ name: 'check_credits', arguments: {} });
    assert.equal(JSON.parse(account.content[0].text).username, 'test-user');
    const generated = await client.callTool({
      name: 'generate_image', arguments: { prompt: 'A synthetic test landscape' }
    });
    assert.equal(generated.isError, undefined);
    const result = JSON.parse(generated.content[0].text);
    assert.equal(result.success, true);
    assert.equal(result.generation_id, 'test-generation');
    assert.equal(result.images[0].id, 'test-image');
  });
});

test('invalid tool inputs are rejected before provider calls', { timeout: 10000 }, async () => {
  await withServer(async client => {
    for (const args of [{}, { prompt: 42 }, { prompt: 'test', num_images: 5 }, { prompt: 'test', model: 'unknown' }]) {
      await assert.rejects(client.callTool({ name: 'generate_image', arguments: args }), /MCP error -32602/);
    }
    await assert.rejects(client.callTool({ name: 'unknown', arguments: {} }), /Unknown tool/);
  });
});

test('missing API keys produce MCP tool errors', { timeout: 10000 }, async () => {
  await withServer(async client => {
    const result = await client.callTool({ name: 'generate_image', arguments: { prompt: 'test' } });
    assert.equal(result.isError, true);
    assert.match(JSON.parse(result.content[0].text).error, /LEONARDO_API_KEY/);
    const account = await client.callTool({ name: 'check_credits' });
    assert.equal(account.isError, true);
  }, '');
});
