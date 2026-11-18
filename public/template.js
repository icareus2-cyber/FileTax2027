import {assessment,bothSpouses,people} from './screening.js';
import {TaxReturn} from './return-model.js';
import {standardDeduction} from './base-tax.js';
import {formDefs,baseForm} from './form-defs.js';
import {strategySection} from './planning.js';
import {liveFields} from './form-inputs.js';
import {params,yearOf,yearText} from './tax-years.js';
// The Quick Assessment decides the filing status and which forms the return needs. Each form
// starts with made-up template figures; the user replaces them with actual data, and the forms
// carry totals to one another and to Form 1040. Template figures are never saved as answers.
const yes=v=>v==='Yes';
const r=Math.round,{max,min}=Math;
export function assessmentProgress(a){
 const rows=assessment(a).flatMap(g=>g.items.flatMap(q=>q.rows));const remaining=rows.filter(row=>!a[row.key]).length;
 return {total:rows.length,remaining,complete:rows.length>0&&remaining===0};
}

// Tax figures come from tax-years.js for the year chosen in the Quick Assessment.
const rates=[.10,.12,.22,.24,.32,.35,.37];
const isJoint=s=>['Married filing jointly','Qualifying surviving spouse'].includes(s);
export function rateScheduleTax(income,status,year=2025){
 if(income===null||income===undefined)return null;const t=params[year].brackets,b=t[status]||t.Single;let tax=0,prev=0;
 rates.forEach((rate,i)=>{const top=b[i]??Infinity;if(income>prev)tax+=(Math.min(income,top)-prev)*rate;prev=top;});
 return r(tax);
}
// Qualified Dividends and Capital Gain Tax Worksheet (Form 1040 instructions).
export function incomeTax(taxable,status,preferential=0,year=2025){
 if(taxable===null||taxable===undefined)return null;
 const ti=max(0,taxable),pref=min(max(0,preferential),ti);if(!pref)return rateScheduleTax(ti,status,year);
 const P=params[year],s=P.zeroRateTop[status]?status:'Single',ordinary=ti-pref;
 const atZero=min(ti,P.zeroRateTop[s])-min(ordinary,min(ti,P.zeroRateTop[s]));
 const atFifteen=min(pref-atZero,max(0,min(ti,P.fifteenRateTop[s])-(ordinary+atZero)));
 const atTwenty=pref-atZero-atFifteen;
 return min(r(atFifteen*.15+atTwenty*.2+rateScheduleTax(ordinary,s,year)),rateScheduleTax(ti,s,year));
}

const order=['1','s1a','2','3','a','b','c','cSpouse','d','8949','e','se','seSpouse','h','8812','eic','2441','8863','8962','8995'];
// Filing status from the assessment: married couples file jointly unless they chose separately
// (or qualify as head of household by living apart); unmarried people with a dependent child
// may be a qualifying surviving spouse or head of household.
export function suggestedStatus(a){
 const married=a.quickMarried==='Yes',separate=married&&a.reviewJoint==='No',family=yes(a.quickFamily);
 if(married)return separate&&yes(a.quickLivedApart)&&family&&a.quickHomeHalf!=='No'?'Head of household':separate?'Married filing separately':'Married filing jointly';
 if(family&&yes(a.quickWidowed))return 'Qualifying surviving spouse';
 if(family&&a.quickHomeHalf!=='No')return 'Head of household';
 return 'Single';
}
// Chooses the filing status and forms from the assessment, with starting template figures.
export function templatePlan(a){
 const people=(bothSpouses(a)?[['','You'],['Spouse','Spouse']]:[['','You']]).map(([s,label],i)=>({s,label,i}));
 const married=a.quickMarried==='Yes',status=suggestedStatus(a),family=yes(a.quickFamily);
 const v={status,digital:yes(a.reviewDigitalSales)?'Yes':'No',special:'No',dependents:family?'Yes':'No',deductionMethod:'Basic standard deduction',
  wages:0,otherWages:0,exemptInterest:0,interest:0,qualifiedDividends:0,dividends:0,iraGross:0,ira:0,pensionGross:0,pension:0,ssGross:0,ss:0,gains:0,additionalIncome:0,adjustments:0,
  qbi:0,extraDeduction:0,schedule2Tax:0,childCredit:0,otherCredits:0,otherTax:0,withheld:0,withheld1099:0,withheldOther:0,estimated:0,eic:0,actc:0,education:0,adoption:0,otherPayments:0};
 const forms={},notes=[],add=(id,defaults={})=>{forms[id]=defaults;},typed=id=>!!a._forms?.[id];
 if(married&&a.reviewJoint==='Not sure / skip')notes.push('Template assumes Married filing jointly because you were not sure; compare with filing separately.');
 if(status==='Head of household'&&a.quickHomeHalf!=='Yes')notes.push('Head of household assumes you paid more than half the cost of keeping up your home; confirm it in the Quick Assessment.');
 if(a.reviewUSHome==='No')notes.push('Template assumes a U.S. resident filing Form 1040. Review Form 1040-NR or Form 2555 if you lived abroad.');
 const wagesBy=people.map(p=>yes(a['reviewW2'+p.s])?[55000,45000][p.i]:0);v.wages=wagesBy.reduce((x,y)=>x+y,0);
 if(yes(a.quickInterest)||yes(a.reviewDividends)||yes(a.quickForeign))add('b',{'1':yes(a.quickInterest)?1200:0,'5':yes(a.reviewDividends)?1800:0,'7a':yes(a.quickForeign)?'Yes':'No','8':'No'});
 if(yes(a.quickForeign))notes.push('Foreign accounts may also require FinCEN Form 114 (FBAR) and Form 8938, filed separately.');
 let early=0;
 for(const p of people){
  if(yes(a['reviewDistributions'+p.s])){
   const amount=[12000,8000][p.i],kind=a.quickDistKind;
   if(kind==='Pension or annuity')v.pensionGross+=amount;else if(kind==='Both'){v.iraGross+=amount/2;v.pensionGross+=amount/2;}else v.iraGross+=amount;
   if(yes(a['quickEarlyWithdrawal'+p.s]))early+=amount;
  }
  if(yes(a['reviewSocialSecurity'+p.s]))v.ssGross+=[24000,18000][p.i];
 }
 if(yes(a.reviewBroker)||yes(a.reviewDigitalSales)){const dg=yes(a.reviewDigitalSales),br=yes(a.reviewBroker);add('8949',{'I-d':dg?5000:0,'I-e':dg?4000:0,'II-d':br?20000:0,'II-e':br?16000:0});add('d');}
 const business=people.filter(p=>yes(a['reviewBusiness'+p.s]));
 for(const p of business){const receipts=yes(a['quickBusinessReceiptsHigh'+p.s])?150000:40000;add('c'+p.s,{'1':receipts,'2':0,'4':0,'6':0,'28':r(receipts*.25),'30':0});add('se'+p.s,{'8a':wagesBy[p.i]});v.estimated+=4000;}
 if(business.length)add('8995');
 const rental=yes(a.reviewRental),k1=yes(a.quickK1);
 if(rental||k1||typed('e')){
  const kind=a.quickRentalKind,rent=!rental||kind==='Royalties'?0:yes(a.planRentalGrossHigh)?150000:36000;
  add('e',{'3':rent,'4':rental&&['Royalties','Both rent and royalties'].includes(kind)?5000:0,'20':r(rent*.3),'32':k1?15000:0,'37':0});
  if(kind==='Rent from multiple properties')notes.push('Schedule E template combines your properties; report each property in its own column on the official form.');
 }
 const ira=people.reduce((t,p)=>t+(yes(a['reviewIRA'+p.s])?7000:0),0),educators=people.filter(p=>yes(a['quickEducator'+p.s])).length;
 if(business.length||rental||k1||yes(a.quickOtherIncome)||ira||yes(a.quickUnemployment)||yes(a.quickStudentLoan)||educators||typed('1'))
  add('1',{'7':yes(a.quickUnemployment)?6000:0,'8z':yes(a.quickOtherIncome)?1000:0,'11':educators*300,'13':0,'16':0,'17':0,'20':ira,'21i':yes(a.quickStudentLoan)?1200:0});
 const tipsOvertime=people.filter(p=>yes(a['quickTipsOvertime'+p.s])).length,seniors=people.filter(p=>yes(a['quickAge65'+p.s])).length;
 if(tipsOvertime||seniors||yes(a.quickCarLoan)||typed('s1a'))add('s1a',{'13i':0,'21i':tipsOvertime*4000,'30i':yes(a.quickCarLoan)?2500:0});
 if(yes(a.quickHomeCosts))add('a',{'1':0,'5d':9000,'8a':12000,'11':2500,'12':0});
 if(family)add('8812',{'4':2,'6':0});
 const earned=wagesBy.some(Boolean)||business.length;
 if((earned||typed('eic'))&&status!=='Married filing separately')add('eic',{'1':family?2:0});
 if(yes(a.reviewCare))add('2441',{'2a':2,'2d':6000});
 if(yes(a.quickEducation))add('8863',{'27':4000});
 if(yes(a.quickMarketplace))add('8962',{'1':people.length+(family?2:0),'11a':12000,'11b':13000,'11f':8000});
 if(yes(a.reviewHousehold))add('h',{'1':20000});
 // Schedules 2 and 3 are always worked out and dropped later if nothing lands on them.
 add('2',{'8':r(early*.1)});add('3',{'1':0,'5':0});
 return {status,values:v,forms,notes,ids:Object.keys(forms).sort((x,y)=>order.indexOf(x)-order.indexOf(y))};
}

// Social Security Benefits Worksheet (Form 1040 instructions): the taxable part of benefits.
export function taxableSocialSecurity(benefits,otherIncome,exempt,adjustments,status,livedApart){
 if(!benefits)return {taxable:0};
 const half=benefits*.5,combined=half+otherIncome+exempt;if(adjustments>=combined)return {taxable:0,combined:0,base:0};
 const provisional=combined-adjustments,joint=status==='Married filing jointly',together=status==='Married filing separately'&&!livedApart;
 const base=joint?32000:together?0:25000,second=joint?12000:together?0:9000;
 const over=provisional-base;if(over<=0)return {taxable:0,provisional,base};
 const upper=Math.max(0,over-second),lower=Math.min(over,second);
 return {taxable:r(Math.min(Math.min(half,lower/2)+upper*.85,benefits*.85)),provisional,base};
}
// Earned income credit from the phase-in and phase-out formula (the IRS table rounds to $50 bands).
export function earnedIncomeCredit(P,kids,earned,agi,joint){
 const e=P.eic.kids[Math.min(3,Math.max(0,kids))],start=joint?e.joint:e.single;
 const f=x=>Math.max(0,Math.min(e.max,x*e.inRate)-Math.max(0,x-start)*e.outRate);
 const onEarned=r(f(earned)),onAgi=agi>start?r(f(agi)):onEarned;
 return {onEarned,onAgi,credit:Math.min(onEarned,onAgi)};
}

const legacy=new Set([...strategySection.fields,...liveFields].map(f=>f[0]));
const lines=x=>new TaxReturn(x).snapshot().lines;
// Builds the whole return: the user's entries win, template figures fill the rest, and
// calculated lines flow between forms. src tells whether each Form 1040 value is the user's,
// a template figure, calculated ('auto', still overridable) or carried from a form ('form').
// Every calculated value records `how`, a formula whose [line], [form:line] and [1040:line]
// references the page shows with their current amounts.
export function buildReturn(user){
 const plan=templatePlan(user),notes=[...plan.notes],typed=user._forms||{};
 const own=Object.fromEntries(Object.entries(user).filter(([k])=>!legacy.has(k)&&!k.startsWith('_')));
 const m={...plan.values,...own},src={},locks={},explain={},lockOwner={};
 for(const k of Object.keys(plan.values))src[k]=own[k]!==undefined?'user':'template';
 for(const k of Object.keys(own))src[k]??='user';
 const template=k=>src[k]==='template';
 const lock=(k,value,label,how)=>{m[k]=value;src[k]='form';locks[k]=label;explain[k]=how;lockOwner[k]=/\[([^:\]]+):/.exec(how)?.[1];};
 const F={};for(const id of plan.ids)F[id]={};
 const has=id=>id in F;
 const inp=(id,line)=>{const u=typed[id]?.[line];const value=u!==undefined?u:plan.forms[id][line]??0;F[id][line]={value,source:u!==undefined?'user':'template'};return value;};
 const calc=(id,line,value,how)=>{F[id][line]={value,source:'calc',how};return value;};
 const get=(id,line)=>F[id]?.[line]?.value??0;
 const sum=(ids,line)=>ids.filter(has).reduce((t,id)=>t+get(id,line),0);
 const refs=(ids,line)=>ids.filter(has).map(id=>`[${id}:${line}]`).join(' + ')||'$0';
 const dollars=n=>'$'+r(n).toLocaleString('en-US');
 const Y=yearOf(user),P=params[Y],status=()=>m.status,mfs=()=>m.status==='Married filing separately',joint=()=>isJoint(m.status);
 const kind=()=>joint()?'joint':mfs()?'mfs':'single',single=()=>joint()?'joint':'single';
 const agi=()=>lines(m)['11a']??0;

 if(has('8949')){calc('8949','I-h',inp('8949','I-d')-inp('8949','I-e'),'[I-d] − [I-e]');calc('8949','II-h',inp('8949','II-d')-inp('8949','II-e'),'[II-d] − [II-e]');}
 if(has('d')){
  const st=calc('d','7',get('8949','I-h'),'[8949:I-h]'),lt=calc('d','15',get('8949','II-h'),'[8949:II-h]'),total=calc('d','16',st+lt,'[7] + [15]');
  lock('gains',calc('d','21',total>=0?total:Math.max(total,mfs()?-1500:-3000),`[16]; a loss is limited to ${mfs()?'$1,500':'$3,000'}`),'Schedule D, line 21','[d:21]');
 }
 if(has('b')){
  const interest=calc('b','4',calc('b','2',inp('b','1'),'[1]'),'[2]');const dividends=calc('b','6',inp('b','5'),'[5]');inp('b','7a');inp('b','8');
  lock('interest',interest,'Schedule B, line 4','[b:4]');lock('dividends',dividends,'Schedule B, line 6','[b:6]');
 }
 // Template figures that follow other entries so the return stays consistent.
 if(template('qualifiedDividends'))m.qualifiedDividends=r((m.dividends??0)*2/3);
 if(template('ira'))m.ira=m.iraGross??0;
 if(template('pension'))m.pension=m.pensionGross??0;
 if(template('withheld'))m.withheld=r((m.wages??0)*.1);
 if(template('withheld1099'))m.withheld1099=r(((m.ira??0)+(m.pension??0))*.1);

 for(const s of ['','Spouse']){
  const c='c'+s,se='se'+s;
  if(has(c)){const l3=calc(c,'3',inp(c,'1')-inp(c,'2'),'[1] − [2]');const l5=calc(c,'5',l3-inp(c,'4'),'[3] − [4]');const l7=calc(c,'7',l5+inp(c,'6'),'[5] + [6]');const l29=calc(c,'29',l7-inp(c,'28'),'[7] − [28]');calc(c,'31',l29-inp(c,'30'),'[29] − [30]');}
  if(has(se)){
   const profit=calc(se,'2',get(c,'31'),`[${c}:31]`);const base=calc(se,'4a',profit*.9235<400?0:r(profit*.9235),'[2] × 92.35%, or zero if less than $400');
   const room=calc(se,'9',Math.max(0,P.ssWageBase-inp(se,'8a')),`${dollars(P.ssWageBase)} − [8a], not less than zero`);const social=calc(se,'10',r(Math.min(base,room)*.124),'smaller of [4a] and [9], × 12.4%'),medicare=calc(se,'11',r(base*.029),'[4a] × 2.9%');
   const tax=calc(se,'12',social+medicare,'[10] + [11]');calc(se,'13',r(tax/2),'[12] × 50%');
  }
 }
 const seNet=sum(['c','cSpouse'],'31')-sum(['se','seSpouse'],'13');
 if(has('e')){
  const net=calc('e','21',inp('e','3')+inp('e','4')-inp('e','20'),'[3] + [4] − [20]');
  // Passive activity limit: up to $25,000 of rental loss with active participation, phased out between $100,000 and $150,000 of modified AGI.
  const rough=lines({...m,additionalIncome:sum(['c','cSpouse'],'31')+(typed['1']?.['7']??plan.forms['1']?.['7']??0),adjustments:0})['11a']??0;
  const allowance=mfs()?0:Math.max(0,25000-.5*Math.max(0,rough-100000));
  const allowed=calc('e','22',net<0?0-Math.min(-net,allowance):0,net<0?`loss in [21] limited to the special allowance of ${dollars(allowance)} ($25,000 reduced by half of modified AGI over $100,000${mfs()?'; none when married filing separately':''})`:'no rental loss');
  calc('e','26',net<0?allowed:net,net<0?'[22]':'[21]');
  if(net<0&&-net>-allowed)notes.push(`Schedule E: ${dollars(-net+allowed)} of rental loss is suspended by the passive activity rules (Form 8582) and carried forward. The template assumes you actively participate.`);
  const k1=inp('e','32')+inp('e','37');calc('e','41',get('e','26')+k1,'[26] + [32] + [37]');
  if(k1)notes.push('K-1 income is included as reported. Self-employment tax on partnership earnings, passive loss rules, and basis limits are not calculated.');
 }
 if(has('h')){const wages=inp('h','1'),covered=wages>=P.householdMin;const ss=calc('h','2',covered?r(wages*.124):0,`[1] × 12.4%, or zero if [1] is under ${dollars(P.householdMin)}`),med=calc('h','4',covered?r(wages*.029):0,`[1] × 2.9%, or zero if [1] is under ${dollars(P.householdMin)}`);calc('h','8e',ss+med,'[2] + [4]');}
 if(has('1')){
  const l3=calc('1','3',sum(['c','cSpouse'],'31'),refs(['c','cSpouse'],'31')),l5=calc('1','5',get('e','41'),has('e')?'[e:41]':'$0');
  lock('additionalIncome',calc('1','10',l3+l5+inp('1','7')+inp('1','8z'),'[3] + [5] + [7] + [8z]'),'Schedule 1, line 10','[1:10]');
  const educators=Math.max(1,people(user).filter(([s])=>user['quickEducator'+s]==='Yes').length);
  const l11=Math.min(inp('1','11'),P.educator*educators);if(l11<get('1','11'))notes.push(`Educator expenses are limited to ${dollars(P.educator*educators)}.`);
  const l15=calc('1','15',sum(['se','seSpouse'],'13'),refs(['se','seSpouse'],'13'));
  const before=l11+inp('1','13')+l15+inp('1','16')+inp('1','17')+inp('1','20');
  lock('adjustments',before,'Schedule 1, line 26','[1:26]');
 }
 // Taxable Social Security uses adjustments other than student loan interest (Pub. 915).
 if(own.ss===undefined){
  const l=lines({...m,ss:0}),other=(l['9']??0),ssr=taxableSocialSecurity(m.ssGross??0,other,m.exemptInterest??0,m.adjustments??0,m.status,user.quickLivedApart==='Yes');
  m.ss=ssr.taxable;src.ss='auto';
  if(m.ssGross)explain.ss=`Social Security Benefits Worksheet: half of [1040:6a] plus other income and tax-exempt interest, minus adjustments = ${dollars(ssr.provisional??0)}; over the ${dollars(ssr.base??0)} base amount, up to 50% and then 85% of the excess is taxable, never more than 85% of [1040:6a]`;
 }
 if(has('1')){
  // Student loan interest: up to $2,500, phased out over modified AGI ranges; not allowed if married filing separately.
  const paid=inp('1','21i'),magi=agi(),start=P.studentLoan.start[single()],range=P.studentLoan.range[single()];
  const keep=mfs()?0:Math.max(0,Math.min(1,1-(magi-start)/range));
  const l21=calc('1','21',r(Math.min(paid,P.studentLoan.max)*keep),mfs()?'$0, not allowed when married filing separately':`smaller of [21i] and $2,500, reduced by modified AGI (${dollars(magi)}) over ${dollars(start)} across ${dollars(range)}`);
  lock('adjustments',calc('1','26',m.adjustments+l21,'[11] + [13] + [15] + [16] + [17] + [20] + [21]'),'Schedule 1, line 26','[1:26]');
 }

 if(has('a')){
  const AGI=agi();
  const floor=calc('a','3',r(AGI*.075),'[1040:11] × 7.5%'),medical=calc('a','4',Math.max(0,inp('a','1')-floor),'[1] − [3], not less than zero');
  const k=mfs()?.5:1,cap=r(Math.max(P.salt.floor*k,P.salt.cap*k-.3*Math.max(0,AGI-P.salt.threshold*k)));
  const salt=calc('a','5e',Math.min(inp('a','5d'),cap),`smaller of [5d] and the SALT limit of ${dollars(cap)}`);
  const total=calc('a','17',medical+salt+inp('a','8a')+inp('a','11')+inp('a','12'),'[4] + [5e] + [8a] + [11] + [12]');
  const std=standardDeduction(m)?.total??0;
  if(own.deductionMethod===undefined)m.deductionMethod=total>std?'Enter verified deduction':'Basic standard deduction';
  if(m.deductionMethod==='Enter verified deduction')lock('deduction',total,'Schedule A, line 17','[a:17]');
  else notes.push(`Schedule A total is less than your ${dollars(std)} standard deduction, so Form 1040 uses the standard deduction.`);
 }
 if(has('s1a')){
  // Schedule 1-A (2025–2028): reductions use modified AGI (Form 1040, line 11).
  const magi=agi(),A=P.schedule1A,noJoint=mfs(),over=(start)=>Math.max(0,Math.ceil((magi-start)/1000));
  const tipCut=100*over(A.tipStart[single()]);
  const tips=calc('s1a','13',noJoint?0:Math.max(0,Math.min(inp('s1a','13i'),A.tips)-tipCut),noJoint?'$0; married couples must file jointly':`smaller of [13i] and $25,000, minus $100 for each $1,000 of MAGI over ${dollars(A.tipStart[single()])}`);
  const overtime=calc('s1a','21',noJoint?0:Math.max(0,Math.min(inp('s1a','21i'),A.overtime[single()])-tipCut),noJoint?'$0; married couples must file jointly':`smaller of [21i] and ${dollars(A.overtime[single()])}, minus $100 for each $1,000 of MAGI over ${dollars(A.tipStart[single()])}`);
  const car=calc('s1a','30',Math.max(0,Math.min(inp('s1a','30i'),A.car)-200*over(A.carStart[single()])),`smaller of [30i] and $10,000, minus $200 for each $1,000 of MAGI over ${dollars(A.carStart[single()])}`);
  const count=people(user).filter(([s])=>user['quickAge65'+s]==='Yes'&&(s===''||joint())).length;
  const senior=calc('s1a','37',noJoint?0:Math.max(0,r(A.senior*count-.06*Math.max(0,magi-A.seniorStart[single()]))),noJoint?'$0; married couples must file jointly':`$6,000 × ${count} ${count===1?'person':'people'} age 65 or older, minus 6% of MAGI over ${dollars(A.seniorStart[single()])}`);
  lock('extraDeduction',calc('s1a','38',tips+overtime+car+senior,'[13] + [21] + [30] + [37]'),'Schedule 1-A, line 38','[s1a:38]');
 }
 if(has('8995')){
  const l=lines({...m,qbi:0});const before=Math.max(0,(l['11a']??0)-(l['12e']??0)-(m.extraDeduction??0));
  const k1=has('e')?Math.max(0,get('e','32')):0;
  const qbi=calc('8995','2',seNet-get('1','16')-get('1','17')+k1,refs(['c','cSpouse'],'31')+' − '+refs(['se','seSpouse'],'13').replaceAll(' + ',' − ')+(has('1')?' − [1:16] − [1:17]':'')+(k1?' + [e:32]':''));const tentative=calc('8995','5',r(Math.max(0,qbi)*.2),'[2] × 20%, not less than zero');
  calc('8995','11',before,'[1040:11] − [1040:12] − [1040:13b]');const gain=calc('8995','12',Math.max(0,m.qualifiedDividends??0)+(has('d')?Math.max(0,Math.min(get('d','15'),get('d','16'))):0),has('d')?'[1040:3a] + the smaller of [d:15] and [d:16] (if positive)':'[1040:3a]');
  const limit=calc('8995','14',r(calc('8995','13',Math.max(0,before-gain),'[11] − [12], not less than zero')*.2),'[13] × 20%');
  lock('qbi',calc('8995','15',Math.min(tentative,limit),'smaller of [5] and [14]'),'Form 8995, line 15','[8995:15]');
  if(before>(joint()?P.qbiThreshold.joint:P.qbiThreshold.single))notes.push('Taxable income is above the Form 8995 threshold; use Form 8995-A instead.');
 }
 // Tax on line 16 is calculated from the return until the user types their own figure.
 const preferential=()=>Math.max(0,m.qualifiedDividends??0)+(has('d')?Math.max(0,Math.min(get('d','15'),get('d','16'))):0);
 if(own.tax===undefined){
  const l=lines({...m,tax:0});const pref=preferential();m.tax=incomeTax(l['15'],m.status,pref,Y)??0;src.tax='auto';
  explain.tax=`${Y} ${m.status} tax rates applied to [1040:15]`+(pref>0?`, with ${dollars(pref)} of qualified dividends and long-term gains taxed at 0%, 15%, or 20% (Qualified Dividends and Capital Gain Tax Worksheet)`:'');
 }
 const AGI=agi(),householdIncome=AGI+(m.exemptInterest??0)+Math.max(0,(m.ssGross??0)-(m.ss??0));
 if(has('8962')){
  // Premium tax credit: the credit is the benchmark premium minus the expected contribution.
  const size=Math.max(1,inp('8962','1')),poverty=calc('8962','4',P.fpl.base+P.fpl.per*(size-1),`${dollars(P.fpl.base)} plus ${dollars(P.fpl.per)} for each person after the first in [1]`);
  calc('8962','3',householdIncome,'[1040:11] + [1040:2a] + ([1040:6a] − [1040:6b])');
  const ratio=calc('8962','5',Math.round(householdIncome/poverty*100)/100,'[3] ÷ [4]');
  const row=P.ptc.find(([lo,hi])=>ratio>=lo&&ratio<hi),eligible=!mfs()&&ratio>=P.ptcFloor&&!!row;
  const pct=calc('8962','7',row?Math.round((row[2]+(row[3]-row[2])*(ratio-row[0])/((row[1]===Infinity?1:row[1])-row[0])||row[2])*10000)/10000:0,Y===2026?'2026 applicable figure table (no credit above 400% of the poverty line)':'2025 applicable figure table (no 400% limit)');
  const contribution=calc('8962','8a',r(householdIncome*pct),'[3] × [7]');
  const premium=inp('8962','11a'),benchmark=inp('8962','11b');
  const credit=calc('8962','11e',eligible?Math.max(0,Math.min(premium,benchmark-contribution)):0,eligible?'smaller of [11a] and ([11b] − [8a]), not less than zero':'$0: household income is outside the eligible range, or married filing separately');
  const net=credit-inp('8962','11f');
  calc('8962','26',Math.max(0,net),'[11e] − [11f], if positive');const excess=calc('8962','27',Math.max(0,-net),'[11f] − [11e], if positive');
  const caps=P.ptcRepayCap,capRow=caps&&caps.find(([limit])=>ratio<limit),cap=capRow?(m.status==='Single'?capRow[1]:capRow[2]):excess;
  calc('8962','28',cap,capRow?`repayment limit for income under ${capRow[0]*100}% of the poverty line`:'no limit');
  calc('8962','29',Math.min(excess,cap),'smaller of [27] and [28]');
  notes.push('Form 8962 uses the 48-state poverty line and one full-year policy; Alaska, Hawaii, and shared or partial-year policies need the official form.');
 }
 // Schedule 2: alternative minimum tax, excess premium credit, and other taxes.
 if(has('2')){
  const l=lines(m),taxable=Math.max(0,l['15']??0),itemizing=m.deductionMethod==='Enter verified deduction'&&has('a');
  const amti=taxable+(itemizing?get('a','5e'):(l['12e']??0)),A=P.amt;
  const exemption=Math.max(0,A.exempt[kind()]-A.phaseRate*Math.max(0,amti-A.phaseStart[kind()]));
  const base=Math.max(0,amti-exemption),bp=mfs()?A.breakpoint.mfs:A.breakpoint.normal,flat=x=>x<=bp?.26*x:.26*bp+.28*(x-bp);
  const pref=Math.min(base,preferential()),tmt=base?Math.min(flat(base),flat(base-pref)+(incomeTax(base,m.status,pref,Y)-rateScheduleTax(base-pref,m.status,Y))):0;
  const amt=calc('2','1',Math.max(0,r(tmt-(m.tax??0))),`tentative minimum tax on ${dollars(base)} (taxable income plus ${itemizing?'state and local taxes':'the standard deduction'}, minus the ${dollars(exemption)} exemption) at 26%/28%, minus [1040:16]`);
  const excessPtc=calc('2','2',get('8962','29'),has('8962')?'[8962:29]':'$0');
  lock('schedule2Tax',calc('2','3',amt+excessPtc,'[1] + [2]'),'Schedule 2, line 3','[2:3]');
  if(amt)notes.push('Alternative minimum tax is estimated without incentive stock options or other preference items (Form 6251).');
  const seTax=calc('2','4',sum(['se','seSpouse'],'12'),refs(['se','seSpouse'],'12')),earlyTax=inp('2','8'),household=calc('2','9',get('h','8e'),has('h')?'[h:8e]':'$0');
  const T=P.addlMedicare[mfs()?'mfs':joint()?'joint':'other'],w=m.wages??0,seEarn=sum(['se','seSpouse'],'4a');
  const medicare=calc('2','11',r(.009*(Math.max(0,w-T)+Math.max(0,seEarn-Math.max(0,T-w)))),`0.9% of wages [1040:1a] and self-employment earnings over ${dollars(T)}`);
  const N=P.niit[mfs()?'mfs':joint()?'joint':'other'],nii=Math.max(0,(m.interest??0)+(m.dividends??0)+Math.max(0,m.gains??0)+(has('e')?Math.max(0,get('e','26')):0));
  const niit=calc('2','12',r(.038*Math.max(0,Math.min(nii,AGI-N))),`3.8% of the smaller of net investment income (${dollars(nii)}) or [1040:11] over ${dollars(N)}`);
  if(medicare)notes.push('Additional Medicare tax your employer withheld (Form W-2, box 6, above $200,000 of wages) is claimed on Form 1040, line 25c.');
  lock('otherTax',calc('2','21',seTax+earlyTax+household+medicare+niit,'[4] + [8] + [9] + [11] + [12]'),'Schedule 2, line 21','[2:21]');
 }
 const taxBeforeCredits=(m.tax??0)+(m.schedule2Tax??0);
 const earned=Math.max(0,(m.wages??0)+(m.otherWages??0)+seNet);
 if(has('8812')){
  const kids=inp('8812','4');
  const l5=calc('8812','5',kids*P.childCredit,`[4] × ${dollars(P.childCredit)}`),l7=calc('8812','7',inp('8812','6')*500,'[6] × $500'),total=calc('8812','8',l5+l7,'[5] + [7]');
  const threshold=joint()?400000:200000,excess=Math.max(0,AGI-threshold);const reduce=calc('8812','11',Math.ceil(excess/1000)*50,`5% of [1040:11] over ${dollars(threshold)}, rounded up to the next $1,000`);
  const credit=calc('8812','12',Math.max(0,total-reduce),'[8] − [11], not less than zero');
  const allowed=calc('8812','14',Math.min(credit,taxBeforeCredits),'smaller of [12] and [1040:18]');lock('childCredit',allowed,'Schedule 8812, line 14','[8812:14]');
  // Additional child tax credit (refundable), Part II-A.
  const unused=calc('8812','16a',credit-allowed,'[12] − [14]'),cap=calc('8812','16b',kids*P.actc.perChild,`[4] × ${dollars(P.actc.perChild)}`),l17=calc('8812','17',Math.min(unused,cap),'smaller of [16a] and [16b]');
  calc('8812','18a',earned,'[1040:1z] + net self-employment earnings');const l20=calc('8812','20',r(calc('8812','19',Math.max(0,earned-P.actc.floor),'[18a] − $2,500, not less than zero')*.15),'[19] × 15%');
  lock('actc',calc('8812','27',Math.min(l17,l20),'smaller of [17] and [20]'),'Schedule 8812, line 27','[8812:27]');
  if(kids>=3&&l20<l17)notes.push('With three or more children, Schedule 8812 Part II-B (using Social Security and Medicare taxes paid) may allow a larger refundable credit.');
 }
 if(has('2441')){
  const persons=inp('2441','2a'),allowed=calc('2441','3',Math.min(inp('2441','2d'),persons>=2?6000:persons===1?3000:0),'smaller of [2d] and $3,000 for one person in [2a], or $6,000 for two or more');
  const rate=calc('2441','8',P.careRate(AGI,joint()),P.careText);
  const credit=calc('2441','9a',r(allowed*rate),'[3] × [8]');calc('2441','11',mfs()?0:credit,mfs()?'$0, not allowed when married filing separately':'[9a]');
  notes.push(mfs()?'Married filing separately generally cannot claim the dependent care credit.':'Dependent care expenses are also limited to the lower earner’s earned income; confirm on Form 2441.');
 }
 if(has('8863')){
  const spent=inp('8863','27'),tentative=calc('8863','30',Math.min(spent,2000)+r(.25*Math.max(0,Math.min(spent,4000)-2000)),'100% of the first $2,000 of [27], plus 25% of the next $2,000');
  const limit=joint()?180000:90000,range=joint()?20000:10000;
  const fraction=calc('8863','6',mfs()?0:Math.min(1,Math.max(0,Math.round((limit-AGI)/range*1000)/1000)),mfs()?'0%, not allowed when married filing separately':`(${dollars(limit)} − [1040:11]) ÷ ${dollars(range)}, between 0% and 100%`);
  const credit=calc('8863','7',r(tentative*fraction),'[30] × [6]'),refundable=calc('8863','8',r(credit*.4),'[7] × 40%');calc('8863','19',credit-refundable,'[7] − [8]');
  lock('education',refundable,'Form 8863, line 8','[8863:8]');
  if(mfs())notes.push('Married filing separately cannot claim education credits.');
 }
 if(has('3')){
  const total=calc('3','8',inp('3','1')+calc('3','2',get('2441','11'),has('2441')?'[2441:11]':'$0')+calc('3','3',get('8863','19'),has('8863')?'[8863:19]':'$0')+inp('3','5'),'[1] + [2] + [3] + [5]');
  lock('otherCredits',Math.min(total,Math.max(0,taxBeforeCredits-(m.childCredit??0))),'Schedule 3, line 8 (limited by tax)','smaller of [3:8] and [1040:18] − [1040:19]');
  const ptc=calc('3','9',get('8962','26'),has('8962')?'[8962:26]':'$0');
  lock('otherPayments',calc('3','15',ptc,'[9]'),'Schedule 3, line 15','[3:15]');
 }
 if(has('eic')){
  const E=P.eic,kids=inp('eic','1'),investment=calc('eic','3',Math.max(0,(m.interest??0)+(m.exemptInterest??0)+(m.dividends??0)+Math.max(0,m.gains??0)+(has('e')?Math.max(0,get('e','21')):0)),'interest, dividends, capital gains, and net rents and royalties');
  calc('eic','2',earned,'[1040:1z] + net self-employment earnings');
  const tooOld=kids===0&&user.quickAge65==='Yes'&&(!joint()||user.quickAge65Spouse==='Yes');
  const res=earnedIncomeCredit(P,kids,earned,AGI,joint()),blocked=mfs()||investment>E.investLimit||tooOld;
  calc('eic','4',res.onEarned,`EIC formula for ${Math.min(3,kids)}${kids>=3?'+':''} qualifying ${kids===1?'child':'children'} applied to [2]`);calc('eic','5',res.onAgi,'same formula applied to [1040:11], if above the phase-out start');
  lock('eic',calc('eic','6',blocked?0:res.credit,blocked?(mfs()?'$0: married filing separately (unless separated)':investment>E.investLimit?`$0: investment income is over ${dollars(E.investLimit)}`:'$0: without a qualifying child you must be under 65'):'smaller of [4] and [5]'),'EIC Worksheet, line 6','[eic:6]');
  if(get('eic','6'))notes.push('Earned income credit assumes you have valid SSNs and lived in the U.S. more than half the year; without children you must also be at least 25. The IRS table rounds to $50 bands, so the official amount may differ by a few dollars.');
 }
 // Drop worked-out forms that have nothing on them, and release the Form 1040 lines they filled.
 for(const id of ['2','3','eic']){
  if(!has(id)||typed[id])continue;
  const values=Object.values(F[id]).map(x=>x.value);
  if(id==='eic'?get('eic','6')!==0:values.some(v=>typeof v==='number'&&v!==0))continue;
  delete F[id];
  for(const [k,owner] of Object.entries(lockOwner))if(owner===id){delete locks[k];delete explain[k];delete lockOwner[k];src[k]=own[k]!==undefined?'user':'template';m[k]=own[k]??plan.values[k];}
 }

 const forms=plan.ids.filter(has).map(id=>{const def=formDefs[baseForm(id)];return {id,title:def.title,subtitle:(id.endsWith('Spouse')?'Spouse — ':bothSpouses(user)&&['c','se'].includes(id)?'You — ':'')+def.subtitle,lines:def.lines.map(l=>({...l,label:yearText(l.label,Y),...F[id][l.line]}))};});
 const amountKeys=Object.keys(plan.values).filter(k=>typeof plan.values[k]==='number');
 const remaining=amountKeys.filter(k=>src[k]==='template').length+forms.reduce((t,f)=>t+f.lines.filter(l=>l.source==='template').length,0);
 return {merged:m,src,locks,explain,forms,notes,remaining};
}
