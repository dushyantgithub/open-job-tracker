import test from 'node:test';
import assert from 'node:assert/strict';
import {submissionMode,submissionInstructions,validateReview} from '../lib/submission-policy.ts';
test('legacy automatic mode stays explicit and manual instructions prohibit submission and require a real handoff',()=>{
 assert.equal(submissionMode({}),'automatic');
 assert.match(submissionInstructions({submissionMode:'manual_review'}),/must NEVER click Submit/);
 assert.match(submissionInstructions({submissionMode:'manual_review'}),/ordinary posting link does not transfer/);
 assert.match(submissionInstructions({submissionMode:'automatic'}),/honor Retry-After/);
 assert.match(submissionInstructions({submissionMode:'automatic'}),/No proxy rotation/);
});
test('review readiness requires complete fields, verified uploads and an unexpired private handoff',()=>{
 const now=Date.now(),r={requestId:'fixture-request',preparedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),method:'same_browser',instructions:'Fixture tab',summary:'Fixture',uploadedFiles:['resume.pdf'],fieldsComplete:true,uploadsComplete:true};
 assert.deepEqual(validateReview(r,now),r);
 for(const patch of [{uploadsComplete:false},{fieldsComplete:false},{uploadedFiles:[]},{uploadedFiles:['/private/resume.pdf']},{expiresAt:new Date(now-1).toISOString()},{method:'saved_draft'},{handoffUrl:'https://example.invalid/draft?token=secret'},{handoffUrl:'javascript:alert(1)'},{handoffUrl:'https://name:secret@example.invalid/draft'}])assert.throws(()=>validateReview({...r,...patch},now));
 assert.equal(validateReview({...r,method:'saved_draft',handoffUrl:'https://example.invalid/draft'},now).method,'saved_draft');
});
