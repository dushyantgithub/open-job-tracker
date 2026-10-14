import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeResume, validatePreferences, remainingBatch, nextScheduledAt, canonicalJobUrl } from '../lib/onboarding-core.ts';
const valid = { selectedRoles:['Backend Engineer'],locations:['US','IN'],indiaCities:['Bangalore','Pune'],frequency:'daily',batchLimit:5,totalLimit:12 };
test('normalizes India selections and keeps exact caps', () => { assert.deepEqual(validatePreferences(valid).indiaCities,['Bengaluru','Pune']); assert.equal(remainingBatch(valid,10),2); assert.equal(remainingBatch(valid,12),0); });
test('rejects unsupported cities, empty scope, impossible and non-integer caps', () => { for (const patch of [{indiaCities:['Delhi']},{locations:[]},{batchLimit:13},{totalLimit:1.5},{frequency:'hourly'},{locations:['UK']},{selectedRoles:[]}]) assert.throws(() => validatePreferences({...valid,...patch})); });
test('role suggestions have actual resume evidence and transparent method', () => { const result=analyzeResume('Engineering Manager. Built a Django backend using PostgreSQL and Redis. Led Python teams.'); assert.equal(result.method,'local_keywords'); assert.ok(result.suggestedRoles.find(r=>r.title==='Engineering Manager')); assert.ok(result.suggestedRoles.find(r=>r.title==='Backend Engineer')); assert.ok(!result.suggestedRoles.find(r=>r.title==='Machine Learning Engineer')); });
test('daily and weekly recurrence is anchored to completed run, manual has no recurrence', () => { const now = new Date('2026-10-14T10:00:00Z'); assert.equal(nextScheduledAt('daily',now),'2026-10-15T10:00:00.000Z'); assert.equal(nextScheduledAt('weekly',now),'2026-10-21T10:00:00.000Z'); assert.equal(nextScheduledAt('manual',now),null); });
test('posting dedup ignores tracking but preserves job identifier query parameters', () => { assert.equal(canonicalJobUrl('https://jobs.example.com/posting/42/?utm_source=x#apply'),'https://jobs.example.com/posting/42'); assert.equal(canonicalJobUrl('https://example.com/careers?job=42&source=linkedin'),'https://example.com/careers?job=42'); assert.notEqual(canonicalJobUrl('https://example.com/?job=42'),canonicalJobUrl('https://example.com/?job=43')); assert.throws(()=>canonicalJobUrl('file:///tmp/resume')); });

test('applicant facts are explicitly provided, preserved and bounded, never inferred', () => {
  assert.equal(validatePreferences(valid).applicantFacts, '');
  const supplied = 'I speak English. I need sponsorship in the United States. Notice period: 30 days.';
  assert.equal(validatePreferences({...valid,applicantFacts:supplied}).applicantFacts, supplied);
  assert.throws(()=>validatePreferences({...valid,applicantFacts:{citizenship:'unknown'}}));
  assert.throws(()=>validatePreferences({...valid,applicantFacts:'a'.repeat(8001)}));
});
