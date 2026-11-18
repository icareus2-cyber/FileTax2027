import {planningSummary} from './planning.js';
import {fields} from './questions.js';
import {screeningNotes} from './screening.js';
import {recommendStrategies} from './strategies.js';
import {exampleKeys} from './examples.js';
import {formDefs,formIds,baseForm,inputKind} from './form-defs.js';
import {params,yearOf} from './tax-years.js';
export function validate(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Answers must be an object.');
 const out={};
 for(const [key,label,type,options] of fields){
  const v=input[key]; if(v===undefined || v==='') continue;
  if(type==='money'||type==='signed'){
   if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e10||(type==='money'&&v<0)) throw Error(`Enter a valid amount for ${label}`);
   out[key]=Math.round(v*100)/100;
  } else {if(typeof v!=='string'||v.length>2000)throw Error(`Invalid ${label}`);
   if(['select','check'].includes(type)&&!options.includes(v))throw Error(`Invalid ${label}`);
   if(type==='state'&&!/^[A-Za-z]{2}$/.test(v))throw Error('Use a two-letter state code.');
   if(type==='zip'&&!/^\d{5}(-\d{4})?$/.test(v))throw Error('Enter a valid ZIP code.');
   out[key]=v.trim();}
 }
 if(out.qualifiedDividends>out.dividends)throw Error('Qualified dividends cannot exceed ordinary dividends.');
 for(const [net,gross] of [['ira','iraGross'],['pension','pensionGross'],['ss','ssGross']])if(out[net]>out[gross])throw Error('Taxable distributions cannot exceed their total.');
 if(input._exampleSeeded!==undefined){if(typeof input._exampleSeeded!=='boolean')throw Error('Invalid example status');out._exampleSeeded=input._exampleSeeded;}
 if(input._exampleSeedVersion!==undefined){if(input._exampleSeedVersion!==2)throw Error('Invalid example version');out._exampleSeedVersion=2;}
 if(input._exampleTouched!==undefined){if(!Array.isArray(input._exampleTouched)||input._exampleTouched.length>exampleKeys.length||input._exampleTouched.some(k=>!exampleKeys.includes(k)))throw Error('Invalid example edits');out._exampleTouched=[...new Set(input._exampleTouched)];}
 if(input._examples!==undefined){if(!input._examples||typeof input._examples!=='object'||Array.isArray(input._examples))throw Error('Invalid example metadata');out._examples={};for(const [k,v]of Object.entries(input._examples)){if(!exampleKeys.includes(k)||typeof v!=='number'||!Number.isFinite(v))throw Error('Invalid example amount');if(out[k]===v)out._examples[k]=v;}}
 // Figures typed on template schedules: {formId: {line: value}}.
 if(input._forms!==undefined){
  if(!input._forms||typeof input._forms!=='object'||Array.isArray(input._forms))throw Error('Invalid form entries');out._forms={};
  for(const [id,lines] of Object.entries(input._forms)){
   if(!formIds.includes(id)||!lines||typeof lines!=='object'||Array.isArray(lines))throw Error('Invalid form entries');const clean={};
   for(const [line,v] of Object.entries(lines)){
    const kind=inputKind(id,line);if(!kind)throw Error('Invalid form entries');
    if(kind==='yesno'){if(!['Yes','No'].includes(v))throw Error('Invalid form entries');clean[line]=v;continue;}
    if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e10||(kind!=='signed'&&v<0)||(kind==='count'&&(!Number.isInteger(v)||v>50)))throw Error(`Enter a valid amount for ${formDefs[baseForm(id)].title}, line ${line}`);
    clean[line]=Math.round(v*100)/100;
   }
   if(Object.keys(clean).length)out._forms[id]=clean;
  }
 }
 // Benefits applied from Key Points: what each changed, so it can be listed and undone.
 if(input._applied!==undefined){
  if(!Array.isArray(input._applied)||input._applied.length>40)throw Error('Invalid applied benefits');
  const num=v=>v===undefined||v===null||(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e10);
  out._applied=input._applied.map(r=>{
   const ok=r&&typeof r==='object'&&/^[a-z0-9-]{1,60}$/.test(r.strategy)&&/^[a-z0-9-]{1,40}$/i.test(r.option)&&typeof r.label==='string'&&r.label.length<=160
    &&['set','add','status','note'].includes(r.mode)&&(r.target===null||r.target===undefined||/^(1040:[A-Za-z0-9]+|form:[A-Za-z0-9]+:[A-Za-z0-9-]+)$/.test(r.target))
    &&num(r.amount)&&num(r.base)&&num(r.delta)&&(num(r.prev)||(typeof r.prev==='string'&&r.prev.length<=40))&&(r.status===undefined||typeof r.status==='string'&&r.status.length<=40);
   if(!ok)throw Error('Invalid applied benefits');
   const {strategy,option,label,amount,mode,target,prev,base,baseOwned,delta,status}=r;
   return Object.fromEntries(Object.entries({strategy,option,label,amount,mode,target:target??null,prev,base,baseOwned:baseOwned===true?true:undefined,delta,status}).filter(([,v])=>v!==undefined));
  });
 }
 return out;
}
// Standard deduction: the basic amount, limited for someone who can be claimed as a dependent,
// plus the additional amount for each box checked for age 65 or older and blindness.
export function standardDeduction(a){
 const P=params[yearOf(a)],basic=P.standard[a.status];if(basic===undefined)return null;
 const married=['Married filing jointly','Married filing separately','Qualifying surviving spouse'].includes(a.status);
 const boxes=['quickAge65','quickBlind',...(a.status==='Married filing jointly'?['quickAge65Spouse','quickBlindSpouse']:[])].filter(k=>a[k]==='Yes').length;
 const earned=Math.max(0,(a.wages??0)+(a.otherWages??0));
 const base=a.quickClaimedDependent==='Yes'?Math.min(basic,Math.max(P.dependentStd.min,earned+P.dependentStd.plus)):basic;
 const add=married?P.extraStd.married:P.extraStd.unmarried;
 return {basic,base,boxes,add,dependent:a.quickClaimedDependent==='Yes',total:base+boxes*add};
}
export function draft(a){
 const n=k=>a[k]===undefined?null:Math.round(a[k]);
 const sum=(...v)=>v.some(x=>x===null)?null:v.reduce((x,y)=>x+y,0);
 const sub=(x,y)=>x===null||y===null?null:x-y;
 const floor=x=>x===null?null:Math.max(0,x);
 const l={}; const map={'1a':'wages','2a':'exemptInterest','2b':'interest','3a':'qualifiedDividends','3b':'dividends','4a':'iraGross','4b':'ira','5a':'pensionGross','5b':'pension','6a':'ssGross','6b':'ss','7a':'gains','8':'additionalIncome','10':'adjustments','13a':'qbi','13b':'extraDeduction','16':'tax','17':'schedule2Tax','19':'childCredit','20':'otherCredits','23':'otherTax','25a':'withheld','25b':'withheld1099','25c':'withheldOther','26':'estimated','27a':'eic','28':'actc','29':'education','30':'adoption','31':'otherPayments'};
 for(const [line,key] of Object.entries(map))l[line]=n(key);
 l['1z']=sum(l['1a'],n('otherWages'));
 l['9']=sum(...['1z','2b','3b','4b','5b','6b','7a','8'].map(k=>l[k]));l['11a']=sub(l['9'],l['10']);l['11b']=l['11a'];
 const std=standardDeduction(a);
 l['12e']=a.deductionMethod==='Enter verified deduction'?n('deduction'):a.deductionMethod==='Basic standard deduction'&&a.special==='No'?(std?std.total:null):null;
 l['14']=sum(l['12e'],l['13a'],l['13b']);l['15']=floor(sub(l['11b'],l['14']));l['18']=sum(l['16'],l['17']);l['21']=sum(l['19'],l['20']);l['22']=floor(sub(l['18'],l['21']));l['24']=sum(l['22'],l['23']);l['25d']=sum(l['25a'],l['25b'],l['25c']);l['32']=sum(...['27a','28','29','30','31'].map(k=>l[k]));l['33']=sum(l['25d'],l['26'],l['32']);l['34']=floor(sub(l['33'],l['24']));l['37']=floor(sub(l['24'],l['33']));
 const warnings=['Draft only. Review filing status, credit eligibility, schedules, and transferred amounts. Complete SSNs, signatures, dependent details, and refund instructions separately.'];
 if(a.special==='Yes')warnings.push('Special deduction rules apply: enter a verified deduction; the basic standard deduction is disabled.');
 if(a.dependents==='Yes')warnings.push('Complete dependent details and Schedule 8812 as applicable. Credits are not determined automatically.');
 if(a.digital==='Yes')warnings.push('Review digital asset transactions for Form 8949, Schedule D, or other schedules.');
 if(a.otherWages>0)warnings.push('Allocate other earned income among lines 1b–1h. The PDF includes this amount in line 1z only.');
 if(['Head of household','Qualifying surviving spouse'].includes(a.status))warnings.push('Verify filing-status eligibility in the IRS instructions.');
 if(Object.values(l).includes(null))warnings.push('Unanswered amounts stay blank. Enter zero for lines that do not apply to calculate totals.');
 return {year:yearOf(a),lines:l,warnings,screeningNotes:screeningNotes(a),strategies:recommendStrategies(a),planningSummary:planningSummary(a)};
}
