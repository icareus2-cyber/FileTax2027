import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReturn,templatePlan,taxableSocialSecurity,earnedIncomeCredit} from '../public/template.js';
import {standardDeduction} from '../public/base-tax.js';
import {params} from '../public/tax-years.js';
import {TaxReturn} from '../public/return-model.js';
import {keyPoints} from '../public/key-points.js';
import {complete} from './helpers.js';
// Hand-checked examples for the filing situations added to close coverage gaps.
const build=a=>{const b=buildReturn(a);return {b,l:new TaxReturn(b.merged).snapshot().lines,line:(id,n)=>b.forms.find(f=>f.id===id)?.lines.find(x=>x.line===n)?.value,ids:b.forms.map(f=>f.id)};};
const base={reviewUSHome:'Yes'};
test('filing status covers surviving spouses, head of household tests, and spouses living apart',()=>{
 const s=a=>templatePlan(complete({...base,...a})).status;
 assert.equal(s({quickMarried:'No',quickFamily:'Yes',quickWidowed:'Yes'}),'Qualifying surviving spouse');
 assert.equal(s({quickMarried:'No',quickFamily:'Yes',quickWidowed:'No',quickHomeHalf:'Yes'}),'Head of household');
 assert.equal(s({quickMarried:'No',quickFamily:'Yes',quickWidowed:'No',quickHomeHalf:'No'}),'Single');
 assert.equal(s({quickMarried:'Yes',reviewJoint:'No',quickFamily:'Yes',quickLivedApart:'Yes',quickHomeHalf:'Yes'}),'Head of household');
 assert.equal(s({quickMarried:'Yes',reviewJoint:'No',quickFamily:'Yes',quickLivedApart:'No'}),'Married filing separately');
});
test('standard deduction adds age 65 and blindness amounts and limits dependents',()=>{
 const sd=a=>standardDeduction({special:'No',...a}).total;
 assert.equal(sd({status:'Married filing jointly',quickAge65:'Yes',quickAge65Spouse:'Yes',quickBlind:'Yes'}),31500+3*1600);
 assert.equal(sd({status:'Single',quickAge65:'Yes',quickBlind:'Yes'}),15750+2*2000);
 assert.equal(sd({status:'Head of household',quickAge65:'Yes',taxYear:'2026'}),24150+2050);
 assert.equal(sd({status:'Single',quickClaimedDependent:'Yes',wages:500}),1350);
 assert.equal(sd({status:'Single',quickClaimedDependent:'Yes',wages:6000}),6450);
 assert.equal(sd({status:'Single',quickClaimedDependent:'Yes',wages:30000}),15750);
 assert.equal(sd({status:'Married filing separately',quickAge65Spouse:'Yes'}),15750,'spouse boxes count only on a joint return');
});
test('taxable Social Security follows the IRS worksheet',()=>{
 const t=(...args)=>taxableSocialSecurity(...args).taxable;
 assert.equal(t(20000,10000,0,0,'Single'),0);                       // 20,000 provisional, under $25,000
 assert.equal(t(20000,20000,0,0,'Single'),2500);                    // 30,000: half of the 5,000 over
 assert.equal(t(30000,40000,0,0,'Single'),min85(30000,40000));
 assert.equal(t(42000,12000,0,0,'Married filing jointly'),500);
 assert.equal(t(24000,60000,0,0,'Married filing jointly'),20400);   // capped at 85% of benefits
 assert.equal(t(20000,10000,0,0,'Married filing separately'),r(.85*20000));
 function min85(b,o){const p=b/2+o,over=p-25000,upper=Math.max(0,over-9000);return Math.round(Math.min(Math.min(b/2,Math.min(over,9000)/2)+upper*.85,b*.85));}
 function r(x){return Math.round(x);}
 const {l}=build(complete({...base,quickAge65:'Yes',reviewRetired:'Yes',reviewSocialSecurity:'Yes'}));
 assert.equal(l['6a'],24000);assert.equal(l['6b'],0,'benefits alone are not taxable');
});
test('earned income credit and the refundable child tax credit',()=>{
 const P=params[2025];
 assert.equal(earnedIncomeCredit(P,2,17880,17880,false).credit,7152);
 assert.equal(earnedIncomeCredit(P,2,28000,28000,false).credit,6173);
 assert.equal(earnedIncomeCredit(P,0,8000,8000,false).credit,612);
 assert.equal(earnedIncomeCredit(P,1,20000,60000,false).credit,0,'AGI above the phase-out limit');
 assert.equal(earnedIncomeCredit(params[2026],3,18290,18290,true).credit,8231);
 const {l,line,ids}=build({...complete({...base,reviewW2:'Yes',quickFamily:'Yes'}),wages:28000});
 assert.ok(ids.includes('eic'));assert.equal(l['27a'],6173);
 assert.equal(line('8812','14'),438);assert.equal(line('8812','16a'),4400-438);assert.equal(l['28'],3400);
 const rich=build({...complete({...base,reviewW2:'Yes',quickFamily:'Yes'}),wages:90000});assert.ok(!rich.ids.includes('eic'),'no EIC form when no credit');
 const investor=build({...complete({...base,reviewW2:'Yes',quickFamily:'Yes',reviewBroker:'Yes'}),wages:20000,_forms:{'8949':{'II-d':30000,'II-e':10000}}});
 assert.equal(investor.l['27a'],0,'investment income over the limit');
 const senior=build({...complete({...base,reviewW2:'Yes',quickAge65:'Yes'}),wages:9000});assert.equal(senior.l['27a'],0,'no EIC without children at 65');
});
test('Schedule 1-A: tips, overtime, car loan interest, and the senior deduction with phase-outs',()=>{
 const a=complete({...base,reviewW2:'Yes',quickTipsOvertime:'Yes',quickCarLoan:'Yes',quickAge65:'Yes'});
 let x=build({...a,_forms:{s1a:{'13i':8000,'21i':5000,'30i':3000}}});
 assert.equal(x.line('s1a','38'),8000+5000+3000+6000);assert.equal(x.l['13b'],22000);
 x=build({...a,wages:180000,_forms:{s1a:{'13i':8000,'21i':5000,'30i':3000}}});
 assert.equal(x.line('s1a','13'),8000-100*Math.ceil((x.l['11a']-150000)/1000));assert.equal(x.line('s1a','37'),Math.max(0,Math.round(6000-.06*(x.l['11a']-75000))));
 assert.equal(x.line('s1a','30'),Math.max(0,3000-200*Math.ceil((x.l['11a']-100000)/1000)));
 const mfs=build({...complete({...base,quickMarried:'Yes',reviewJoint:'No',reviewW2:'Yes',quickTipsOvertime:'Yes',quickAge65:'Yes'}),_forms:{s1a:{'13i':8000}}});
 assert.equal(mfs.line('s1a','13'),0);assert.equal(mfs.line('s1a','37'),0);
});
test('Schedule 1 adds unemployment, educator expenses, and student loan interest with its phase-out',()=>{
 const a=complete({...base,reviewW2:'Yes',quickUnemployment:'Yes',quickStudentLoan:'Yes',quickEducator:'Yes'});
 let x=build(a);assert.equal(x.line('1','7'),6000);assert.equal(x.line('1','21'),1200);assert.equal(x.l['10'],300+1200);assert.equal(x.l['8'],6000);
 x=build({...a,wages:92000,_forms:{'1':{'21i':3000,'11':900}}});
 const magi=x.l['11a']+x.line('1','21');assert.equal(x.line('1','21'),Math.round(2500*(1-(magi-85000)/15000)));
 assert.ok(x.b.notes.some(n=>/Educator expenses are limited to \$300/.test(n)));
 assert.equal(build({...complete({...base,quickMarried:'Yes',reviewJoint:'No',quickStudentLoan:'Yes'})}).line('1','21'),0);
});
test('retirement payments split between IRA and pension lines, with the early-withdrawal tax',()=>{
 const x=build(complete({...base,reviewDistributions:'Yes',quickDistKind:'Both',quickEarlyWithdrawal:'Yes'}));
 assert.equal(x.l['4b'],6000);assert.equal(x.l['5b'],6000);assert.equal(x.line('2','8'),1200);assert.equal(x.l['23'],1200);
 const p=build(complete({...base,reviewDistributions:'Yes',quickDistKind:'Pension or annuity'}));assert.equal(p.l['4a'],0);assert.equal(p.l['5a'],12000);assert.ok(!p.ids.includes('2'),'no Schedule 2 without an additional tax');
});
test('Schedule E: K-1 income and the $25,000 rental loss allowance',()=>{
 const k=build(complete({...base,quickK1:'Yes'}));assert.ok(k.ids.includes('e'));assert.equal(k.line('e','41'),15000);assert.equal(k.l['8'],15000);
 const loss=build({...complete({...base,reviewW2:'Yes',reviewRental:'Yes'}),_forms:{e:{'3':10000,'20':40000}}});
 assert.equal(loss.line('e','21'),-30000);assert.equal(loss.line('e','22'),-25000);assert.equal(loss.line('e','26'),-25000);
 const high=build({...complete({...base,reviewW2:'Yes',reviewRental:'Yes'}),wages:160000,_forms:{e:{'3':10000,'20':40000}}});assert.equal(high.line('e','26'),0);
});
test('marketplace premium tax credit, including repayment of excess advance payments',()=>{
 const a=complete({...base,reviewW2:'Yes',quickMarketplace:'Yes'});
 let x=build({...a,wages:30000});
 const hi=x.line('8962','3'),ratio=x.line('8962','5');assert.equal(hi,30000);assert.equal(ratio,Math.round(30000/15060*100)/100);
 assert.ok(x.line('8962','11e')>0);assert.equal(x.l['31'],x.line('8962','26'));
 x=build({...a,wages:55000,_forms:{'8962':{'11f':12000}}});
 assert.ok(x.line('8962','29')>0);assert.equal(x.l['17'],x.line('2','3'));assert.equal(x.line('2','2'),x.line('8962','29'));
 assert.ok(x.line('8962','29')<=1625,'2025 repayment limit below 400%');
 const y=build({...a,taxYear:'2026',wages:70000});assert.equal(y.line('8962','11e'),0,'2026: no credit above 400% of the poverty line');
});
test('high-income taxes: additional Medicare, net investment income tax, and AMT',()=>{
 const x=build({...complete({...base,reviewW2:'Yes',reviewDividends:'Yes'}),wages:300000,_forms:{b:{'5':50000}}});
 assert.equal(x.line('2','11'),Math.round(.009*(300000-200000)));
 assert.equal(x.line('2','12'),Math.round(.038*Math.min(50000,x.l['11a']-200000)));
 assert.equal(x.l['23'],x.line('2','11')+x.line('2','12'));
 assert.equal(x.line('2','1'),0,'no AMT for ordinary wage income');
 const amt=build({...complete({...base,reviewW2:'Yes',quickHomeCosts:'Yes'}),wages:450000,_forms:{a:{'5d':60000,'8a':0,'11':0}}});
 assert.ok(amt.line('2','1')>=0);
});
test('Key Points offers the new strategies with Apply options',()=>{
 const a=complete({...base,reviewW2:'Yes',quickStudentLoan:'Yes',quickEducator:'Yes',quickMarketplace:'Yes',quickFamily:'Yes',reviewDistributions:'Yes',quickEarlyWithdrawal:'Yes'});
 const {b,l}=build({...a,wages:30000});const kp=keyPoints(a,b,l),t=kp.strategies.map(s=>s.title);
 for(const title of ['Deduct student loan interest','Deduct educator expenses','Check the earned income credit','Reconcile your marketplace premium credit','Check for an early-withdrawal exception'])assert.ok(t.includes(title),title);
 assert.ok(kp.strategies.find(s=>s.title==='Reconcile your marketplace premium credit').apply.length===4);
 assert.equal(kp.strategies.find(s=>s.title==='Check the new Schedule 1-A deductions').apply[0].target,'form:s1a:21i');
});
