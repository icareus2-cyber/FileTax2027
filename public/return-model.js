import {validate,draft as baseDraft} from './base-tax.js';
const n=(a,k)=>a[k]===undefined?null:Math.round(a[k]);
const add=(...v)=>v.some(x=>x===null)?null:v.reduce((a,b)=>a+b,0);
const subtract=(a,b)=>a===null||b===null?null:a-b;
export class TaxForm {
 constructor(id,title,lines,notes=[]){Object.assign(this,{id,title,lines,notes,status:'Estimated draft'});}
}
export class ScheduleC extends TaxForm {
 constructor(a){
  const l={'1':n(a,'strategyBusinessReceipts'),'2':n(a,'businessReturns'),'4':n(a,'businessCOGS'),'6':n(a,'businessOther'),'30':n(a,'businessHome')};
  l['3']=subtract(l['1'],l['2']);l['5']=subtract(l['3'],l['4']);l['7']=add(l['5'],l['6']);
  l['28']=add(n(a,'strategyBusinessExpenses'),n(a,'businessDepreciation'));l['29']=subtract(l['7'],l['28']);l['31']=subtract(l['29'],l['30']);
  super('c','Schedule C',l,['One sole-proprietor business only. Allocate the aggregate expense estimate to lines 8–27 before filing. Schedule SE and loss-limit forms are not generated.']);
  this.transfer=l['31']===null?null:l['31']<0?(a.businessAllowedLoss===undefined?null:-Math.round(a.businessAllowedLoss)):l['31'];
  if(l['31']<0&&a.businessAllowedLoss!==undefined&&Math.round(a.businessAllowedLoss)>-l['31'])throw Error('Allowable business loss cannot exceed the estimated business loss.');
  if(['Partnership','S corporation','C corporation'].includes(a.planEntity)){this.transfer=null;this.unsupported=true;this.notes.push('This entity does not use this sole-proprietor Schedule C. Related income totals are blocked until the entity reporting is resolved.');}
 }
}
export class ScheduleE extends TaxForm {
 constructor(a){
  const l={'3':n(a,'strategyRentalReceipts'),'18':n(a,'rentalDepreciation')};l['20']=add(n(a,'strategyRentalExpenses'),l['18']);l['21']=subtract(l['3'],l['20']);
  l['22']=l['21']===null?null:l['21']<0?n(a,'rentalAllowedLoss'):0;
  if(l['21']<0&&l['22']!==null&&l['22']>-l['21'])throw Error('Allowable rental loss cannot exceed the estimated rental loss.');
  l['23a']=l['3'];l['23d']=l['18'];l['23e']=l['20'];l['24']=l['21']===null?null:Math.max(0,l['21']);l['25']=l['22'];l['26']=subtract(l['24'],l['25']);
  super('e','Schedule E',l,['One rental real-estate property, Part I only. Allocate operating expenses to lines 5–19. Personal-use, at-risk and passive-loss limits require review; other properties, royalties, and K-1 activities are not modeled.']);
  this.transfer=l['26'];
 }
}
export class Schedule1 extends TaxForm {
 constructor(a,c,e){
  const l={'3':c?c.transfer:0,'5':e?e.transfer:0,'20':n(a,'liveIRADeduction')};
  l['10']=add(l['3'],l['5'],n(a,'liveOtherIncome'));l['26']=add(l['20'],n(a,'liveOtherAdjustments'));
  super('1','Schedule 1',l,['Other income and other adjustments are aggregate estimates; allocate them to individual lines before filing. IRA deductibility is an input estimate, not automatically determined.']);
 }
}
export class TaxReturn {
 constructor(answers={}){this.answers=validate(answers);}
 update(changes){return new TaxReturn({...this.answers,...changes});}
 snapshot(){
  const a=this.answers;
  // Automatic zero placeholders do not create an activity or replace manual totals.
  const has=keys=>keys.some(k=>a[k]!==undefined&&!(a[k]===0&&a._examples?.[k]===0));
  const c=has(['strategyBusinessReceipts','strategyBusinessExpenses','businessReturns','businessCOGS','businessOther','businessDepreciation','businessHome','businessAllowedLoss'])?new ScheduleC(a):null;
  const e=has(['strategyRentalReceipts','strategyRentalExpenses','rentalDepreciation','rentalAllowedLoss','rentalAddress'])?new ScheduleE(a):null;
  const linked=!!(c||e||has(['liveIRADeduction','liveOtherIncome','liveOtherAdjustments']));
  const s1=linked?new Schedule1(a,c,e):null;
  const computed={...a};
  if(s1){if(s1.lines['10']===null)delete computed.additionalIncome;else computed.additionalIncome=s1.lines['10'];if(s1.lines['26']===null)delete computed.adjustments;else computed.adjustments=s1.lines['26'];}
  const result=baseDraft(computed);
  const notes=['Estimates only; validation checks data and arithmetic, not tax eligibility. Unknown amounts remain blank.'];
  if(s1)notes.push('Schedule 1 controls Form 1040 lines 8 and 10. Previous manual totals are retained but excluded to prevent double counting. Enter zero explicitly for other income, IRA deduction, and other adjustments when none apply.');
  if(c)notes.push('Income tax, self-employment tax, and the related deduction are not automatically calculated. Revisit the tax inputs after changing profit.');
  result.warnings.push(...notes,...[c,e,s1].filter(Boolean).flatMap(f=>f.notes));
  result.forms=[new TaxForm('1040','Form 1040',result.lines,notes),s1,c?.unsupported?null:c,e].filter(Boolean);
  result.linked=linked;result.estimated=true;
  result.exampleFields=Object.keys(a._examples||{});
  if(result.exampleFields.length)result.warnings.unshift('HYPOTHETICAL EXAMPLES remain in '+result.exampleFields.length+' fields. Replace them with your figures before relying on any form. Example expense percentages are not deduction allowances.');
  return result;
 }
}
