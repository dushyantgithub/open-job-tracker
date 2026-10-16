import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

// Exercise the real worker routes against an isolated loopback D1 database.
// No provider CLI, browser or real employer is used.
test('pause is immediate, preserves in-flight proof, and permits explicit stopped-agent recovery', {timeout:60_000}, async () => {
  const root=resolve(import.meta.dirname,'..');
  const directory=await mkdtemp(resolve(tmpdir(),'tracker-pause-test-'));
  const wrangler=resolve(root,'node_modules/wrangler/bin/wrangler.js');
  const prefix=['--import',resolve(root,'scripts/sites-env.mjs'),wrangler];
  const config=JSON.parse(await readFile(resolve(root,'dist/server/wrangler.json'),'utf8'));
  const migrations=resolve(directory,'migrations.json');
  await writeFile(migrations,JSON.stringify({name:'pause-test',compatibility_date:'2026-05-01',d1_databases:config.d1_databases.map(db=>({...db,migrations_dir:resolve(root,'drizzle')}))}));
  const env={...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'};
  let child;
  try {
    const migrated=spawnSync(process.execPath,[...prefix,'d1','migrations','apply','DB','--local','--config',migrations,'--persist-to',directory],{cwd:root,env,encoding:'utf8'});
    assert.equal(migrated.status,0,migrated.stdout+migrated.stderr);
    const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));
    const port=reserve.address().port;await new Promise(r=>reserve.close(r));
    const origin=`http://127.0.0.1:${port}`;
    child=spawn(process.execPath,[...prefix,'dev','--config','dist/server/wrangler.json','--local','--persist-to',directory,'--ip','127.0.0.1','--inspector-port','0','--port',String(port)],{cwd:root,env,stdio:['ignore','pipe','pipe']});
    let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
    let ready=false;
    for(let n=0;n<80;n++){
      if(child.exitCode!==null)throw Error(logs);
      try{const response=await fetch(`${origin}/api/data`);if(response.ok && response.headers.get('content-type')?.includes('application/json') && Array.isArray((await response.json()).jobs)){ready=true;break;}}catch{}
      await new Promise(r=>setTimeout(r,250));
    }
    assert.ok(ready,logs);
    async function api(path,body){
      const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:body instanceof FormData?{Origin:origin}:{Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
      const text=await response.text();
      assert.ok(response.headers.get('content-type')?.includes('application/json'),`${path}: HTTP ${response.status}: ${text}\n${logs}`);
      return {status:response.status,...JSON.parse(text)};
    }
    assert.equal((await api('/api/data')).verifiedTotal,0,'fixture must be empty');
    const form=new FormData();form.append('resume',new Blob(['Synthetic backend engineer fixture. Built backend services using Python, Django and PostgreSQL. Led delivery of application APIs and collaborated with product and engineering teams. This resume exists only for isolated API testing.'],{type:'text/plain'}),'fixture.txt');
    assert.equal((await api('/api/onboarding/resume',form)).status,201);
    const prefs={selectedRoles:['Backend Engineer'],locations:['US'],indiaCities:[],frequency:'manual',batchLimit:3,totalLimit:12,applicantFacts:'Synthetic fixture only.'};
    const selectedSources=['LinkedIn','Naukri','Instahyre','Wellfound','Cutshort','Indeed'];
    assert.equal((await api('/api/onboarding',{...prefs,searchPortals:selectedSources})).status,200);
    // Older clients must not erase source preferences when saving other fields.
    const salaryRules={EU:{minimum:null,currency:'EUR',basis:'base'},US:{minimum:null,currency:'USD',basis:'base'},IN:{minimum:3500000,currency:'INR',basis:'base'},AU:{minimum:160000,currency:'AUD',basis:'total'},CA:{minimum:155000,currency:'CAD',basis:'base'}};
    assert.equal((await api('/api/onboarding',{...prefs,salaryRules,applyWithoutSalary:false})).status,200);
    const savedPreferences=(await api('/api/onboarding',prefs)).preferences;
    assert.deepEqual(savedPreferences.searchPortals,selectedSources);
    assert.deepEqual(savedPreferences.salaryRules,salaryRules);assert.equal(savedPreferences.applyWithoutSalary,false);
    const handoff=await api('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_handoff',arguments:{}}});
    const handedOff=JSON.parse(handoff.result.content[0].text);
    assert.deepEqual(handedOff.preferences.searchPortals,selectedSources);
    assert.deepEqual(handedOff.preferences.salaryRules,salaryRules);
    assert.match(handedOff.salaryInstructions,/NO. Skip roles with no published compensation/);
    assert.ok(selectedSources.every(source=>handedOff.searchInstructions.includes(source)));
    const discovery={discoverySource:'LinkedIn',discoveryUrl:'https://www.linkedin.com/jobs/view/synthetic-fixture',discoveredAt:'2026-01-02T03:04:05Z'};
    assert.equal((await api('/api/jobs',{id:'synthetic-discovery',company:'Synthetic Fixture',title:'Engineer',status:'discovered',...discovery})).status,200);
    assert.equal((await api('/api/jobs',{id:'synthetic-discovery',portal:'Greenhouse',jobUrl:'https://example.invalid/apply'})).status,200);
    let record=(await api('/api/data')).jobs.find(j=>j.id==='synthetic-discovery');
    assert.equal(record.discoverySource,'LinkedIn');assert.equal(record.discoveryUrl,discovery.discoveryUrl);assert.equal(record.portal,'Greenhouse');
    assert.equal((await api('/api/jobs',{id:'synthetic-discovery',discoverySource:'Greenhouse'})).status,400);
    assert.equal((await api('/api/onboarding/start',{})).status,201);
    const claim=await api('/api/worker',{action:'tick',workerId:'fixture-worker'});
    assert.deepEqual(claim.preferences.searchPortals,selectedSources);
    assert.deepEqual(claim.preferences.salaryRules,salaryRules);assert.equal(claim.preferences.applyWithoutSalary,false);
    assert.match(claim.salaryInstructions,/INR 35 lakh/);
    assert.ok(selectedSources.every(source=>claim.searchInstructions.includes(source)));
    const id=claim.request.id, target=claim.request.target, baseline=claim.request.baseTotal;
    assert.equal((await api('/api/worker',{action:'confirm_stopped',requestId:id})).status,409,'must pause first');
    const pause=await api('/api/worker',{action:'pause'});
    assert.equal(pause.run.status,'paused');assert.equal(pause.acknowledgementPending,true);
    assert.equal(pause.request.status,'pausing');assert.equal(pause.request.target,target);assert.equal(pause.request.baseTotal,baseline);
    assert.equal(pause.request.notes,claim.request.notes,'checkpoint is retained');
    assert.equal((await api('/api/worker',{action:'heartbeat',workerId:'fixture-worker',requestId:id})).paused,true);
    assert.equal((await api('/api/worker',{action:'tick',workerId:'another-worker'})).request,null);
    assert.equal((await api('/api/onboarding',prefs)).status,409,'uncertain work still protects editing');
    assert.equal((await api('/api/more',{})).status,409,'no overlapping batches');
    // A form transmitted before pause can still have its observed receipt saved.
    assert.equal((await api('/api/jobs',{id:'synthetic-receipt',company:'Synthetic Fixture',title:'Backend Engineer',jobUrl:'https://example.invalid/jobs/synthetic-receipt',status:'applied',appliedAt:new Date().toISOString(),confirmation:'Synthetic receipt. No employer submission occurred.'})).status,200);
    assert.equal((await api('/api/worker',{action:'pause'})).run.status,'paused','repeat pause remains paused');
    assert.equal((await api('/api/worker',{action:'confirm_stopped',requestId:'stale-request'})).status,409);
    const recovered=await api('/api/worker',{action:'confirm_stopped',requestId:id});
    assert.equal(recovered.status,200);assert.equal(recovered.request.status,'cancelled');
    assert.equal(recovered.request.target,target);assert.equal(recovered.request.baseTotal,baseline);
    assert.equal((await api('/api/data')).verifiedTotal,1);
    assert.equal((await api('/api/onboarding',prefs)).status,200,'editing unlocked');
    const late=await api('/api/worker',{action:'finish',workerId:'fixture-worker',requestId:id,status:'blocked',message:'Late worker acknowledgement'});
    assert.equal(late.alreadyFinished,true);assert.equal((await api('/api/data')).run.status,'paused');
    assert.equal((await api('/api/more',{})).status,201);
    const next=await api('/api/worker',{action:'tick',workerId:'fixture-worker'});
    assert.equal((await api('/api/worker',{action:'pause'})).run.status,'paused');
    const stopped=await api('/api/worker',{action:'finish',workerId:'fixture-worker',requestId:next.request.id,status:'blocked',message:'Stopped with saved evidence.'});
    assert.equal(stopped.request.status,'cancelled','normal worker acknowledgement also releases');
    assert.equal((await api('/api/more',{})).status,201);
    const queuedPause=await api('/api/worker',{action:'pause'});
    assert.equal(queuedPause.acknowledgementPending,false);assert.equal(queuedPause.request,null);
    assert.equal((await api('/api/onboarding',prefs)).status,200);
    assert.equal((await api('/api/worker',{action:'tick',workerId:'fixture-worker'})).request,null);
  } finally {
    if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('close',r));}
    await rm(directory,{recursive:true,force:true});
  }
});
