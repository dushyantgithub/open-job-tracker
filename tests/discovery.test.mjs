import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreferences } from '../lib/onboarding-core.ts';
import { defaultSearchPortals, searchPortalOptions, sourceSearchInstructions, validateDiscovery } from '../lib/job-sources.ts';
const prefs={selectedRoles:['Engineering Manager'],locations:['IN'],indiaCities:['Bengaluru'],frequency:'daily',batchLimit:25,totalLimit:100};
test('search portals accept all six requested sources, deduplicate, and reject empty or unknown selections',()=>{
 const sources=['LinkedIn','Naukri','Instahyre','Wellfound','Cutshort','Indeed'];
 assert.deepEqual(validatePreferences({...prefs,searchPortals:[...sources,'LinkedIn']}).searchPortals,sources);
 assert.deepEqual(validatePreferences(prefs).searchPortals,defaultSearchPortals);
 for(const searchPortals of [[],['Unconfigured source'],'LinkedIn',[12]])assert.throws(()=>validatePreferences({...prefs,searchPortals}));
 assert.ok(sources.every(s=>searchPortalOptions.includes(s)));
});
test('handoff requires portal coverage and factual blocked outcomes',()=>{
 const instructions=sourceSearchInstructions(['LinkedIn','Indeed']);
 assert.match(instructions,/LinkedIn, Indeed/);assert.match(instructions,/every selected search portal/);
 assert.match(instructions,/blocked, never checked/);assert.match(instructions,/never infer discovery/);
});
test('discovery stays distinct from application portal and unknown history is valid',()=>{
 const first={discoverySource:'LinkedIn',discoveryUrl:'https://www.linkedin.com/jobs/view/123',discoveredAt:'2026-01-02T03:04:05Z'};
 assert.doesNotThrow(()=>validateDiscovery({}));
 assert.doesNotThrow(()=>validateDiscovery({...first,portal:'Greenhouse'},first));
 assert.throws(()=>validateDiscovery({...first,discoverySource:'Greenhouse'},first),/original/);
 assert.throws(()=>validateDiscovery({...first,discoveryUrl:'https://example.com/application'},first),/original/);
 for(const discoveryUrl of ['javascript:alert(1)','file:///tmp/test','https://user:password@example.com/jobs'])assert.throws(()=>validateDiscovery({discoveryUrl}));
 assert.throws(()=>validateDiscovery({discoveredAt:'yesterday'}));
 assert.throws(()=>validateDiscovery({discoverySource:''}));
});
