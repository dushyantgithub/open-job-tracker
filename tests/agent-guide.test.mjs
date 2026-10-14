import test from 'node:test';
import assert from 'node:assert/strict';
import { agentPrompt } from '../lib/agent-guide.ts';
test('cloud Dot cannot be handed local loopback origins', () => {
  for (const origin of ['http://localhost:8787','http://127.0.0.1:8787','http://[::1]:8787','https://localhost']) {
    assert.throws(()=>agentPrompt('dot',origin),/owner-private HTTPS/);
  }
  assert.match(agentPrompt('dot','https://tracker.example.com'),/https:\/\/tracker.example.com\/api\/agent-guide/);
});
test('setup prompts reject insecure remote URLs and embedded credentials', () => {
  for (const provider of ['dot','codex','claude']) {
    for (const origin of ['http://tracker.example.com','https://user:secret@tracker.example.com','https://tracker.example.com?token=secret','https://tracker.example.com#secret','file:///tmp/tracker']) assert.throws(()=>agentPrompt(provider,origin));
  }
});
test('local integrations preserve the chosen origin without inheriting applicant data', () => {
  for (const provider of ['codex','claude']) {
    assert.match(agentPrompt(provider,'http://127.0.0.1:8787'),/http:\/\/127.0.0.1:8787\/api\/agent-guide/);
  }
});
