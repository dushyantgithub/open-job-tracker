import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSalaryRules, validateSalaryRules, formatSalaryRule, salarySearchInstructions } from '../lib/salary-preferences.ts';
import { validatePreferences } from '../lib/onboarding-core.ts';
const prefs={selectedRoles:['Engineer'],locations:['IN'],indiaCities:['Bengaluru'],frequency:'manual',batchLimit:2,totalLimit:10};
test('regional salary rules retain currency, annual basis and INR units without default applicant floors',()=>{
 const rules=defaultSalaryRules();assert.ok(Object.values(rules).every(r=>r.minimum===null));
 rules.IN={minimum:3500000,currency:'INR',basis:'base'};rules.AU={minimum:160000,currency:'AUD',basis:'total'};
 assert.deepEqual(validateSalaryRules(rules),rules);
 assert.equal(formatSalaryRule(rules.IN),'INR 35 lakh / year (base)');
 assert.match(formatSalaryRule(rules.AU),/AUD 160,000.*total compensation/);
 assert.deepEqual(validatePreferences({...prefs,salaryRules:rules,applyWithoutSalary:false}).salaryRules,rules);
 assert.equal(validatePreferences({...prefs,salaryRules:rules,applyWithoutSalary:false}).applyWithoutSalary,false);
});
test('invalid salary amounts, currencies, basis and checkbox values are rejected',()=>{
 for(const minimum of [-1,Infinity,NaN,'3500000',1000000001])assert.throws(()=>validateSalaryRules({IN:{minimum,currency:'INR',basis:'base'}}));
 for(const patch of [{currency:'XYZ'},{basis:'monthly'}])assert.throws(()=>validateSalaryRules({IN:{minimum:3500000,currency:'INR',basis:'base',...patch}}));
 assert.throws(()=>validateSalaryRules({UK:{minimum:1,currency:'USD',basis:'base'}}));
 for(const applyWithoutSalary of ['false',0,null])assert.throws(()=>validatePreferences({...prefs,applyWithoutSalary}));
 assert.equal(validatePreferences(prefs).salaryRules,undefined,'legacy salary facts are not silently overwritten');
});
test('agent handoff treats undisclosed salary as an explicit choice and requires comparable amounts',()=>{
 const salaryRules=defaultSalaryRules();salaryRules.US.minimum=160000;
 assert.match(salarySearchInstructions({salaryRules,applyWithoutSalary:false}),/NO. Skip roles with no published compensation/);
 assert.match(salarySearchInstructions({salaryRules,applyWithoutSalary:true}),/YES. Roles without a published salary/);
 assert.match(salarySearchInstructions({salaryRules}),/USD 160,000/);
 assert.match(salarySearchInstructions({salaryRules}),/override older salary/);
 assert.match(salarySearchInstructions({salaryRules}),/verify a current exchange rate/);
 assert.match(salarySearchInstructions({salaryRules}),/maximum is below the minimum/);
});
