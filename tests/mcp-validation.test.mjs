import test from 'node:test';
import assert from 'node:assert/strict';
import { runnerSetupSchema } from '../lib/mcp-validation.ts';
const manual={workerId:'owner-1',provider:'dot',executionEnvironment:'cloud',mode:'manual',browserVerified:true,resumeFileVerified:true};
test('runner setup cannot claim a cloud Dot on a local environment or unverified file tools',()=>{
 assert.ok(runnerSetupSchema.safeParse(manual).success);
 for(const patch of [{executionEnvironment:'local'},{browserVerified:false},{resumeFileVerified:false},{workerId:'../owner'}])assert.ok(!runnerSetupSchema.safeParse({...manual,...patch}).success);
});
test('scheduled setup needs actual future schedule metadata while manual cannot pretend one exists',()=>{
 const scheduled={...manual,mode:'scheduled',scheduleId:'synthetic-schedule',timeZone:'UTC',nextCheckAt:new Date(Date.now()+86400000).toISOString()};
 assert.ok(runnerSetupSchema.safeParse(scheduled).success);
 for(const patch of [{scheduleId:undefined},{timeZone:'Not/A_Timezone'},{nextCheckAt:'2000-01-01T00:00:00Z'}])assert.ok(!runnerSetupSchema.safeParse({...scheduled,...patch}).success);
 assert.ok(!runnerSetupSchema.safeParse({...manual,scheduleId:'not-a-manual-schedule'}).success);
});
