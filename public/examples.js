import {strategySection} from './planning.js';
export const exampleKeys=[...new Set(strategySection.fields.filter(f=>['money','signed'].includes(f[2])).map(f=>f[0]))];
export function referenceExamples(a){
 const values={},reasons={},notes=[];
 const set=(key,value,reason)=>{values[key]=value;reasons[key]=reason;};
 if(a.reviewBusiness==='No'&&a.quickBusinessReceiptsHigh==='Yes')notes.push('Your business answers conflict. Confirm whether you had business income before loading a business example.');
 else if(a.reviewBusiness==='Yes'){
  const receipts=Object.hasOwn(a._examples||{},'strategyBusinessReceipts')?(a.quickBusinessReceiptsHigh==='Yes'?150000:10000):(a.strategyBusinessReceipts??(a.quickBusinessReceiptsHigh==='Yes'?150000:10000));
  set('strategyBusinessReceipts',receipts,a.quickBusinessReceiptsHigh==='Yes'?'Illustrative receipts above $100,000.':'Illustrative receipts of $10,000; replace with your total.');
  set('strategyBusinessExpenses',Math.round(receipts*.25),'Illustration only: 25% of receipts. This is not an industry norm, deduction allowance, or recommended claim.');
  for(const key of ['businessReturns','businessCOGS','businessOther','businessDepreciation','businessHome'])set(key,0,'Simple service-business example assumes none. Replace if applicable.');
 }
 if(a.reviewRental==='No'&&a.planRentalGrossHigh==='Yes')notes.push('Your rental answers conflict. Confirm whether you received rent before loading a rental example.');
 else if(a.reviewRental==='Yes'){
  if(a.quickRentalKind==='Rent from one property'){
   const receipts=Object.hasOwn(a._examples||{},'strategyRentalReceipts')?(a.planRentalGrossHigh==='Yes'?150000:36000):(a.strategyRentalReceipts??(a.planRentalGrossHigh==='Yes'?150000:36000));
   set('strategyRentalReceipts',receipts,a.planRentalGrossHigh==='Yes'?'Illustrative rents above $100,000.':'Illustrative rent of $3,000 per month for 12 months.');
   set('strategyRentalExpenses',Math.round(receipts*.30),'Illustration only: 30% of rent. This is not a deductible-expense allowance.');
   set('rentalDepreciation',0,'Example placeholder only. Actual depreciation needs the property basis and dates.');
  }else notes.push('Choose “Rent from one property” in Quick assessment for a rental example. Multiple properties and royalties need separate details.');
 }
 if(a.reviewIRA==='Yes')set('strategyIRABudget',1000,'Hypothetical amount to explore, not a contribution already made, an approved limit, or an IRA deduction.');
 if(Object.keys(values).length){
  set('liveIRADeduction',0,'Example assumes no deductible IRA contribution until you supply an eligible amount.');
  set('liveOtherAdjustments',0,'Example assumes no other adjustments. Review items such as the deductible part of self-employment tax.');
  if(a.quickOtherIncome==='No')set('liveOtherIncome',0,'You indicated no other income; review before relying on this example.');
 }
 for(const key of exampleKeys)if(values[key]===undefined)set(key,0,'Automatic zero placeholder: no amount supplied. Replace it if this item applies; zero does not confirm the absence of income or eligibility for a deduction.');
 return {values,reasons,notes};
}
export function seedExamples(input){
 const a=structuredClone(input),{values}=referenceExamples(a);
 const touched=new Set(a._exampleTouched||[]);a._examples={...a._examples};
 for(const [key,value]of Object.entries(values))if(a[key]===undefined||(!touched.has(key)&&Object.hasOwn(a._examples,key)&&a[key]===a._examples[key])){const initial=touched.has(key)?0:value;a[key]=initial;a._examples[key]=initial;}
 for(const [key,,type,options]of strategySection.fields)if(type==='select'&&a[key]===undefined&&options.includes('Not sure / skip'))a[key]='Not sure / skip';
 a._exampleSeeded=true;a._exampleSeedVersion=2;return a;
}
export function replaceExample(a,key){
 if(!exampleKeys.includes(key))return;
 if(a._examples)delete a._examples[key];
 a._exampleTouched=[...new Set([...(a._exampleTouched||[]),key])];
}
export function removeExamples(input){
 const a=structuredClone(input);
 for(const key of Object.keys(a._examples||{})){delete a[key];replaceExample(a,key);}
 a._examples={};return a;
}
