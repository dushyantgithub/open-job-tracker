import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTakeover, takeoverInstructions } from '../lib/takeover.ts';
import { increasesPace } from '../lib/application-pace.ts';
import { companyCareers, sourceSearchInstructions } from '../lib/job-sources.ts';
test('takeover requires stopped actions and a supported credential-free handoff',()=>{
 const v={jobId:'fixture',reason:'CAPTCHA',checkpoint:'Before Submit',instructions:'Use the same session.',method:'remote_takeover',handoffUrl:'https://example.invalid/session',expiresAt:'2030-01-01T00:00:00Z',stopped:true};
 assert.equal(validateTakeover(v).jobId,'fixture');
 for(const patch of [{stopped:false},{handoffUrl:undefined},{handoffUrl:'https://example.invalid/?token=secret'},{expiresAt:'2020-01-01'},{method:'unavailable'}])assert.throws(()=>validateTakeover({...v,...patch}));
 assert.equal(validateTakeover({...v,method:'unavailable',handoffUrl:undefined,expiresAt:undefined}).method,'unavailable');
 assert.match(takeoverInstructions,/SAME persistent workerId/);assert.match(takeoverInstructions,/uncertainty must block a retry/);
});
test('pace warnings compare with saved settings without inventing a safe threshold',()=>{
 const saved={frequency:'weekly',batchLimit:10,totalLimit:100};
 assert.equal(increasesPace({...saved,frequency:'daily'},saved),true);
 assert.equal(increasesPace({...saved,batchLimit:11},saved),true);
 assert.equal(increasesPace({...saved,totalLimit:101},saved),true);
 assert.equal(increasesPace(saved,saved),false);
 assert.equal(increasesPace({...saved,frequency:'manual',batchLimit:5},saved),false);
});
test('official sources and balanced instructions preserve fit and block boundaries',()=>{
 const instruction=sourceSearchInstructions(Object.keys(companyCareers),'balanced');
 for(const url of Object.values(companyCareers))assert.ok(instruction.includes(url));
 assert.match(instruction,/least represented/);assert.match(instruction,/Never downgrade role fit/);assert.match(instruction,/not proven ATS protection/);assert.match(instruction,/Never switch sources, accounts or networks/);
 assert.doesNotMatch(sourceSearchInstructions(['Company careers'],'best_fit'),/least represented/);
});
