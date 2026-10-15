import test from 'node:test';
import assert from 'node:assert/strict';
import { mcpResponse } from '../lib/mcp-protocol.ts';
const tools=[{name:'read',description:'read',inputSchema:{type:'object'},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}];
const call=async()=>({content:[{type:'text',text:'ok'}]});
test('discovery and listing do not invoke mutation tools',async()=>{
 const fail=async()=>{throw Error('must not execute')};
 assert.deepEqual((await mcpResponse({jsonrpc:'2.0',id:1,method:'server/discover'},tools,fail)).result.supportedVersions,['2026-07-28']);
 assert.deepEqual((await mcpResponse({jsonrpc:'2.0',id:'list',method:'tools/list'},tools,fail)).result.tools,tools);
});
test('unknown tools and malformed RPCs never reach the dispatcher',async()=>{
 let called=false;const fail=async()=>{called=true};
 assert.equal((await mcpResponse({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'sql'}},tools,fail)).error.code,-32602);
 for(const input of [null,[],{method:'tools/list'},{jsonrpc:'2.0',id:{},method:'tools/list'}]) assert.equal((await mcpResponse(input,tools,fail)).error.code,-32600);
 assert.equal(called,false);
});
test('tool failures are truthful errors without private error details',async()=>{
 const out=await mcpResponse({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'read'}},tools,async()=>{throw Error('private credential')});
 assert.equal(out.result.isError,true);assert.ok(!JSON.stringify(out).includes('private credential'));
 assert.equal((await mcpResponse({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'read'}},tools,call)).result.content[0].text,'ok');
});
test('notifications produce no spurious response',async()=>{assert.equal(await mcpResponse({jsonrpc:'2.0',method:'notifications/initialized'},tools,call),null)});
