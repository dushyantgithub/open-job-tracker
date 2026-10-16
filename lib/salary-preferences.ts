export const salaryRegions = ["EU", "US", "IN", "AU", "CA"] as const;
export const salaryCurrencies = ["EUR", "USD", "INR", "AUD", "CAD"] as const;
export type SalaryRegion = typeof salaryRegions[number];
export type SalaryCurrency = typeof salaryCurrencies[number];
export interface SalaryRule { minimum: number | null; currency: SalaryCurrency; basis: "base" | "total"; }
export type SalaryRules = Record<SalaryRegion, SalaryRule>;
export const salaryRegionLabels: Record<SalaryRegion, string> = {EU:"European Union",US:"United States",IN:"India",AU:"Australia",CA:"Canada"};
const localCurrencies: Record<SalaryRegion, SalaryCurrency> = {EU:"EUR",US:"USD",IN:"INR",AU:"AUD",CA:"CAD"};
export function defaultSalaryRules(): SalaryRules {
  return Object.fromEntries(salaryRegions.map(region=>[region,{minimum:null,currency:localCurrencies[region],basis:"base"}])) as SalaryRules;
}
export function validateSalaryRules(value: unknown): SalaryRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Salary rules must be specified by region.");
  const input=value as Record<string, unknown>;
  if(Object.keys(input).some(region=>!(salaryRegions as readonly string[]).includes(region)))throw new Error("Unsupported salary region.");
  const result=defaultSalaryRules();
  for(const region of salaryRegions){
    if(input[region]===undefined)continue;
    const value=input[region];
    if(!value || typeof value!=="object" || Array.isArray(value))throw new Error(`Invalid salary rule for ${region}.`);
    const rule=value as Record<string,unknown>;
    if(rule.minimum!==null && (typeof rule.minimum!=="number" || !Number.isFinite(rule.minimum) || rule.minimum<0 || rule.minimum>1_000_000_000))throw new Error(`Enter a valid annual salary minimum for ${region}, or leave it blank.`);
    if(!(salaryCurrencies as readonly unknown[]).includes(rule.currency))throw new Error(`Choose a supported currency for ${region}.`);
    if(rule.basis!=="base" && rule.basis!=="total")throw new Error(`Choose base salary or total compensation for ${region}.`);
    result[region]={minimum:rule.minimum as number|null,currency:rule.currency as SalaryCurrency,basis:rule.basis};
  }
  return result;
}
export function formatSalaryRule(rule: SalaryRule): string {
  if(rule.minimum===null)return "No minimum set";
  const amount=rule.currency==="INR" ? `INR ${Number((rule.minimum/100000).toFixed(5)).toLocaleString("en-IN")} lakh` : `${rule.currency} ${rule.minimum.toLocaleString("en-US",{maximumFractionDigits:2})}`;
  return `${amount} / year (${rule.basis==="base"?"base":"total compensation / CTC"})`;
}
export function salarySearchInstructions(preferences: {salaryRules?:SalaryRules;applyWithoutSalary?:boolean}) {
  const rules=preferences.salaryRules;
  return `SALARY FILTERS\n${rules ? "The structured salaryRules below override older salary amounts or exceptions in applicantFacts. Apply each rule only to its region.\n"+salaryRegions.map(region=>`${salaryRegionLabels[region]}: ${formatSalaryRule(rules[region])}`).join("\n") : "Use only salary requirements explicitly supplied in applicantFacts; no regional minimum has been entered in salaryRules."}\nApply when salary is not listed: ${preferences.applyWithoutSalary===false?"NO. Skip roles with no published compensation figure.":"YES. Roles without a published salary can be considered, but do not invent a salary or claim they meet a numeric minimum."}\nAll minima are annual and use the saved currency and compensation basis. Check published ranges: skip a role when its maximum is below the minimum. An overlapping range may qualify only with an expectation at or above the minimum. Never compare base with total compensation or annual with monthly pay without reliable evidence. If currency conversion is needed, verify a current exchange rate and record its source and date; do not compare nominal amounts across currencies. A listed but ambiguous or incomparable salary needs review, not treatment as an undisclosed salary. Keep the posting's actual salary and your assessment in the job record. Never guess missing compensation details or silently lower a saved minimum.`;
}
