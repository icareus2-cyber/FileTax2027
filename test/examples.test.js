import test from 'node:test';
import assert from 'node:assert/strict';
import {seedExamples,replaceExample,removeExamples} from '../public/examples.js';
import {validate,draft} from '../tax.js';
import {strategySection} from '../public/planning.js';
test('assessment changes refresh automatic zeros but never overwrite user amounts',()=>{
 let a=seedExamples({reviewBusiness:'No'});
 a.reviewBusiness='Yes';a=seedExamples(a);assert.equal(a.strategyBusinessReceipts,10000);assert.equal(a.strategyBusinessExpenses,2500);
 a.quickBusinessReceiptsHigh='Yes';a=seedExamples(a);assert.equal(a.strategyBusinessReceipts,150000);
 replaceExample(a,'strategyBusinessReceipts');a.strategyBusinessReceipts=7777;
 a.quickBusinessReceiptsHigh='No';a=seedExamples(a);assert.equal(a.strategyBusinessReceipts,7777);
 a.strategyBusinessReceipts=0;a=seedExamples(a);assert.equal(a.strategyBusinessReceipts,0);
});
test('all strategy amounts default to zero with no activity, including existing drafts',()=>{
 const a=seedExamples({reviewBusiness:'No',reviewRental:'No',reviewIRA:'No',_exampleSeeded:true,additionalIncome:123});
 for(const [key,,type]of strategySection.fields)if(['money','signed'].includes(type))assert.equal(a[key],0,key);
 for(const [key,,type]of strategySection.fields)if(type==='select')assert.equal(a[key],'Not sure / skip',key);
 const s=draft(a);assert.equal(s.lines['8'],123);assert.deepEqual(s.forms.map(f=>f.id),['1040']);
 assert.equal(validate(a)._exampleSeedVersion,2);
});
test('assessment selects coherent examples and propagates labels into the return',()=>{
 const a=seedExamples({reviewBusiness:'Yes',quickBusinessReceiptsHigh:'Yes',reviewRental:'Yes',quickRentalKind:'Rent from one property',planRentalGrossHigh:'No',reviewIRA:'Yes',quickOtherIncome:'No'});
 assert.equal(a.strategyBusinessReceipts,150000);assert.equal(a.strategyBusinessExpenses,37500);
 assert.equal(a.strategyRentalReceipts,36000);assert.equal(a.strategyRentalExpenses,10800);assert.equal(a.strategyIRABudget,1000);
 assert.equal(a.strategyTraditionalIRA,0);assert.equal(a.liveIRADeduction,0);
 const s=draft(validate(a));assert.equal(s.lines['8'],137700);assert.ok(s.exampleFields.includes('strategyBusinessReceipts'));assert.match(s.warnings[0],/HYPOTHETICAL/);
});
test('unknown, contradictory, royalties and multiple-property answers do not invent receipts',()=>{
 for(const a of [{},{reviewBusiness:'No',quickBusinessReceiptsHigh:'Yes'},{reviewRental:'Yes',quickRentalKind:'Royalties'},{reviewRental:'Yes',quickRentalKind:'Rent from multiple properties'}]){
 const seeded=seedExamples(a);assert.equal(seeded.strategyBusinessReceipts,0);assert.equal(seeded.strategyRentalReceipts,0);
 }
});
test('user edits and zeros survive; cleared fields return as zero when refilled',()=>{
 let a=seedExamples({reviewBusiness:'Yes',strategyBusinessReceipts:80000,businessCOGS:0});
 assert.equal(a._examples.strategyBusinessReceipts,undefined);assert.equal(a._examples.businessCOGS,undefined);
 replaceExample(a,'strategyBusinessExpenses');a.strategyBusinessExpenses=12000;
 replaceExample(a,'businessReturns');delete a.businessReturns;
 a=seedExamples(a);assert.equal(a.strategyBusinessExpenses,12000);assert.equal(a.businessReturns,0);
 const cleaned=removeExamples(a);assert.equal(cleaned.strategyBusinessReceipts,80000);assert.equal(cleaned.strategyBusinessExpenses,12000);assert.equal(cleaned.businessCOGS,0);assert.deepEqual(cleaned._examples,{});
 assert.deepEqual(validate(a)._examples,a._examples);
 assert.throws(()=>validate({_examples:{wages:100}}),/Invalid example amount/);
});
