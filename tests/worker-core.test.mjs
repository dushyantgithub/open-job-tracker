import test from 'node:test';
import assert from 'node:assert/strict';
import { trackerOrigin, safeResumeName, validateUpdate, completeLines, buildPrompt } from '../scripts/worker-core.mjs';

test('worker accepts local/private HTTPS origins and refuses credential-bearing or plaintext remote URLs', () => {
  assert.equal(trackerOrigin(), 'http://127.0.0.1:8787');
  assert.equal(trackerOrigin('https://private.example.com'), 'https://private.example.com');
  for (const url of ['http://public.example.com', 'https://a:b@example.com', 'https://example.com/?token=x', 'file:///tmp']) assert.throws(() => trackerOrigin(url));
});
test('resume names cannot escape the private run folder', () => {
  assert.equal(safeResumeName('../../secret.pdf'), 'secret.pdf');
  assert.equal(safeResumeName('..\\secret.pdf'), 'secret.pdf');
  assert.equal(safeResumeName('..'), 'resume.txt');
});
test('partial writes are held until a newline and final complete lines are supported', () => {
  assert.deepEqual(completeLines('{"id":"1"}\n{"id":'), { lines: ['{"id":"1"}'], nextOffset: 11 });
  assert.deepEqual(completeLines('{"id":"1"}', 0, true).lines, ['{"id":"1"}']);
  assert.throws(() => completeLines('', 10));
});
test('applied updates require real evidence fields and stable ids ignore tracking params', () => {
  assert.throws(() => validateUpdate({ id: 'a', status: 'applied' }));
  const base = { company: 'Example', title: 'Engineer', status: 'applied', appliedAt: '2026-10-14T00:00:00Z', confirmation: 'Application received', jobUrl: 'https://example.com/job/123?utm_source=a' };
  assert.equal(validateUpdate(base).id, validateUpdate({ ...base, jobUrl: 'https://example.com/job/123?utm_source=b' }).id);
  assert.throws(() => validateUpdate({ ...base, appliedAt: 'tomorrow' }));
});
test('agent prompt binds run cap and requires verification without approval bypass', () => {
  const prompt = buildPrompt({ id: 'request-test', baseTotal: 7, count: 3, target: 10 });
  assert.match(prompt, /no more than 3 additional applications/);
  assert.match(prompt, /stop at total 10/);
  assert.match(prompt, /applied ONLY after observing/);
  assert.match(prompt, /Do not bypass CAPTCHAs/);
});
