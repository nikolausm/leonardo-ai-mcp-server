import assert from 'node:assert/strict';

export default async function fetch(url, options = {}) {
  assert.equal(options.headers?.Authorization, 'Bearer synthetic-test-key');
  const json = data => ({ ok: true, json: async () => data });
  if (url === 'https://cloud.leonardo.ai/api/rest/v1/me') {
    return json({ user_details: [{ username: 'test-user', apiConcurrencySlots: 3 }] });
  }
  if (url === 'https://cloud.leonardo.ai/api/rest/v1/generations') {
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), {
      prompt: 'A synthetic test landscape',
      modelId: '6bef9f1b-29cb-40c7-b9df-32b51c1f67d3',
      width: 512, height: 512, num_images: 1, guidance_scale: 7, public: false
    });
    return json({ sdGenerationJob: { generationId: 'test-generation' } });
  }
  if (url === 'https://cloud.leonardo.ai/api/rest/v1/generations/test-generation') {
    return json({ generations_by_pk: {
      status: 'COMPLETE',
      generated_images: [{ id: 'test-image', url: 'https://example.invalid/test-image.png' }]
    } });
  }
  throw new Error('Unexpected HTTP request; all provider requests must be mocked');
}
