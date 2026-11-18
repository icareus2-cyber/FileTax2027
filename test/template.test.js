import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {assessment} from '../public/screening.js';
import {assessmentProgress,buildReturn,incomeTax,rateScheduleTax,templatePlan} from '../public/template.js';
import {TaxReturn} from '../public/return-model.js';
import {validate} from '../public/base-tax.js';
import {draft} from '../tax.js';
import {complete} from './helpers.js';
const ids=a=>buildReturn(complete(a)).forms.map(f=>f.id);
const lines=b=>new TaxReturn(b.merged).snapshot().lines;
const line=(b,id,n)=>b.forms.find(f=>f.id===id).lines.find(l=>l.line===n);
test('template turns on only when every visible question is answered',()=>{
 assert.equal(assessmentProgress({}).complete,false);
 const a=complete({});assert.equal(assessmentProgress(a).complete,true);
 assert.equal(assessmentProgress({...a,quickMarried:'Yes'}).complete,false);
 assert.equal(assessmentProgress({...a,reviewW2:'Not sure / skip'}).complete,true);
});
test('the assessment decides filing status and which forms the return needs',()=>{
 assert.deepEqual(ids({}),[]);
 assert.deepEqual(ids({reviewBroker:'Yes'}),['d','8949']);
 assert.deepEqual(ids({quickInterest:'Yes'}),['b']);
 assert.deepEqual(ids({reviewBusiness:'Yes'}),['1','2','c','se','8995']);
 assert.deepEqual(ids({reviewRental:'Yes',quickRentalKind:'Royalties'}),['1','e']);
 assert.deepEqual(ids({quickFamily:'Yes',reviewCare:'Yes',quickEducation:'Yes'}),['3','8812','2441','8863']);
 assert.deepEqual(ids({reviewHousehold:'Yes'}),['2','h']);
 assert.deepEqual(ids({quickHomeCosts:'Yes'}),['a']);
 assert.deepEqual(ids({quickMarried:'Yes',reviewJoint:'Yes, jointly with my spouse',reviewBusinessSpouse:'Yes'}),['1','2','cSpouse','seSpouse','8995']);
 assert.equal(templatePlan(complete({quickMarried:'Yes',reviewJoint:'Yes, jointly with my spouse'})).status,'Married filing jointly');
 assert.equal(templatePlan(complete({quickMarried:'Yes',reviewJoint:'No'})).status,'Married filing separately');
 assert.equal(templatePlan(complete({quickFamily:'Yes'})).status,'Head of household');
 assert.equal(templatePlan(complete({quickFamily:'Yes',quickHomeHalf:'No'})).status,'Single');
 assert.equal(templatePlan(complete({quickMarried:'No',quickFamily:'Yes',quickWidowed:'Yes'})).status,'Qualifying surviving spouse');
 assert.equal(templatePlan(complete({quickMarried:'Yes',reviewJoint:'No',quickFamily:'Yes',quickLivedApart:'Yes'})).status,'Head of household');
 assert.equal(templatePlan(complete({quickMarried:'Yes',reviewJoint:'No',quickFamily:'Yes',quickLivedApart:'No'})).status,'Married filing separately');
 assert.equal(templatePlan(complete({})).status,'Single');
});
test('figures typed on a schedule replace the template and flow through the forms to Form 1040',()=>{
 const a=complete({reviewBusiness:'Yes',reviewW2:'Yes'});
 const t=buildReturn(a);assert.equal(line(t,'c','1').source,'template');assert.equal(lines(t)['8'],30000);
 const b=buildReturn({...a,_forms:{c:{'1':90000,'28':20000}}});
 assert.equal(line(b,'c','1').source,'user');assert.equal(line(b,'c','31').value,70000);
 assert.equal(line(b,'se','2').value,70000);assert.equal(line(b,'se','4a').value,64645);assert.equal(line(b,'se','12').value,9891);
 assert.equal(line(b,'1','10').value,70000);assert.equal(line(b,'1','15').value,4946);
 const l=lines(b);assert.equal(l['8'],70000);assert.equal(l['10'],4946);assert.equal(l['23'],9891);
 assert.equal(b.locks.additionalIncome,'Schedule 1, line 10');assert.ok(b.remaining<t.remaining);
});
test('schedules apply 2025 limits: capital losses, SALT, credits, and household wages',()=>{
 const d=buildReturn({...complete({reviewBroker:'Yes'}),_forms:{'8949':{'II-d':1000,'II-e':9000}}});
 assert.equal(line(d,'d','16').value,-8000);assert.equal(lines(d)['7a'],-3000);
 const mfs=complete({quickMarried:'Yes',reviewJoint:'No',reviewBroker:'Yes',quickEducation:'Yes'});
 assert.equal(lines(buildReturn({...mfs,_forms:{'8949':{'II-d':0,'II-e':9000}}}))['7a'],-1500);
 assert.equal(line(buildReturn(mfs),'8863','7').value,0);
 const a=buildReturn({...complete({quickHomeCosts:'Yes'}),_forms:{a:{'5d':60000,'8a':0,'11':0}}});
 assert.equal(line(a,'a','5e').value,40000);assert.equal(lines(a)['12e'],40000);assert.equal(a.locks.deduction,'Schedule A, line 17');
 const small=buildReturn({...complete({quickHomeCosts:'Yes',reviewW2:'Yes'}),_forms:{a:{'5d':1000,'8a':0,'11':0}}});assert.equal(lines(small)['12e'],15750);assert.equal(small.locks.deduction,undefined);
 const big=buildReturn(complete({quickHomeCosts:'Yes',reviewW2:'Yes'}));assert.equal(lines(big)['12e'],23500);
 const kids=buildReturn(complete({quickFamily:'Yes',reviewW2:'Yes'}));assert.equal(line(kids,'8812','5').value,4400);assert.equal(lines(kids)['19'],Math.min(4400,lines(kids)['18']));
 const h=buildReturn({...complete({reviewHousehold:'Yes'}),_forms:{h:{'1':2000}}});assert.equal(line(h,'h','8e').value,0);
});
test('tax uses the 2025 rate schedule and the qualified dividends and capital gain worksheet',()=>{
 assert.equal(rateScheduleTax(94805,'Married filing jointly'),10900);
 assert.equal(rateScheduleTax(50000,'Single'),5914);
 assert.equal(incomeTax(50000,'Single',10000),4810);
 assert.equal(incomeTax(50000,'Single',0),5914);
 const a=complete({reviewW2:'Yes'});const b=buildReturn(a);
 assert.equal(b.src.tax,'auto');assert.equal(lines(b)['16'],rateScheduleTax(55000-15750,'Single'));
 assert.equal(buildReturn({...a,tax:1234}).merged.tax,1234);
 const own=buildReturn({...a,wages:80000});assert.equal(own.merged.withheld,8000);assert.equal(own.merged.tax,rateScheduleTax(80000-15750,'Single'));
});
test('typed schedule figures are validated and saved; template figures are not',()=>{
 assert.deepEqual(validate({_forms:{c:{'1':5000},b:{'7a':'Yes'}}})._forms,{c:{'1':5000},b:{'7a':'Yes'}});
 for(const bad of [{x:{'1':1}},{c:{'3':1}},{c:{'1':-1}},{'8812':{'4':1.5}},{b:{'7a':'Maybe'}}])assert.throws(()=>validate({_forms:bad}));
});
test('forms are editable in the page, carry totals to Form 1040, and only typed figures are saved',async()=>{
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 let stored=complete({reviewW2:'Yes',reviewBusiness:'Yes'});delete stored.reviewHousehold;
 global.fetch=async(url,options={})=>{if(options.method==='PUT')stored=JSON.parse(options.body).answers;return {ok:true,status:200,json:async()=>({answers:stored,step:0,updated:null,draft:draft(stored)})};};
 const $=s=>document.querySelector(s);const type=(el,v)=>{el.value=v;el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 try{
  await import('../public/app.js?template');await new Promise(r=>setTimeout(r,30));
  assert.equal($('#wages').value,'55000');assert.ok($('[data-form="c"]'));
  assert.match($('#template-banner').textContent,/1 Quick Assessment question is still unanswered/);
  assert.ok($('[data-question="reviewHousehold"]').classList.contains('unanswered'));assert.equal(document.querySelectorAll('.assess-q.unanswered').length,1);
  $('#reviewHousehold-1').click();
  assert.equal(document.querySelectorAll('.assess-q.unanswered').length,0);assert.doesNotMatch($('#template-banner').textContent,/unanswered/);
  assert.equal($('#wages').value,'55000');assert.ok($('#wages').classList.contains('template'));assert.equal($('#status-0').checked,true);
  assert.ok($('[data-form="c"]'));assert.ok($('[data-form="se"]'));assert.equal($('[data-form="h"]'),null);
  assert.equal($('#f-c-1').value,'40000');assert.ok($('#f-c-1').classList.contains('template'));
  assert.equal($('#additionalIncome').readOnly,true);assert.equal($('#additionalIncome').value,'30000');
  assert.ok($('#tax').classList.contains('auto'));
  type($('#f-c-1'),'100000');
  assert.equal($('#f-c-1').classList.contains('template'),false);assert.equal($('#additionalIncome').value,'90000');
  assert.equal($('[data-form="1"] [data-line="10"]').textContent,'$90,000');
  assert.match($('[data-form="c"] .stamp').textContent,/TEMPLATE · \d+ left/);
  type($('#wages'),'60000');
  await new Promise(r=>setTimeout(r,600));
  assert.deepEqual(stored._forms,{c:{'1':100000}});assert.equal(stored.wages,60000);
  for(const k of ['tax','withheld','additionalIncome','status'])assert.equal(stored[k],undefined,k);
  $('#template-banner button').click();await new Promise(r=>setTimeout(r,600));
  assert.equal(stored._forms.c['2'],0);assert.equal(stored.otherWages,0);assert.equal(stored._forms.c['28'],undefined);
  assert.equal($('[data-form="c"] .stamp').textContent,'TEMPLATE · 1 left');
 }finally{dom.window.close();Object.assign(global,previous);}
});

test('a partly answered assessment still fills Form 1040 and the forms it calls for',async()=>{
 // The saved draft reported as "not filled": marital status and IRA were unanswered.
 const saved={reviewUSHome:'Yes',reviewW2:'Yes',reviewRetired:'No',reviewBusiness:'Yes',reviewDividends:'Yes',reviewBroker:'Yes',reviewDigitalSales:'No',reviewRental:'Yes',reviewDistributions:'No',reviewSocialSecurity:'No',reviewCare:'Yes',reviewHousehold:'No',quickRentalKind:'Rent from one property',quickBusinessReceiptsHigh:'Yes',planRentalGrossHigh:'Yes',quickInterest:'Yes',quickForeign:'No',quickOtherIncome:'No',quickFamily:'Yes',quickEducation:'No',quickHomeCosts:'No'};
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 global.fetch=async()=>({ok:true,status:200,json:async()=>({answers:saved,step:0,updated:'x',draft:draft(saved)})});
 const $=s=>document.querySelector(s);
 try{
  await import('../public/app.js?partial');await new Promise(r=>setTimeout(r,30));
  assert.equal($('#error').hidden,true);
  assert.equal($('#wages').value,'55000');assert.equal($('#status-3').checked,true);
  assert.deepEqual([...document.querySelectorAll('#template-forms .tform')].map(f=>f.dataset.form),['1','2','3','b','c','d','8949','e','se','8812','2441','8995']);
  const open=[...document.querySelectorAll('.assess-q.unanswered')].map(q=>q.dataset.question);
  assert.ok(open.includes('quickMarried')&&open.includes('reviewIRA')&&open.includes('quickAge65'));
  assert.match($('#template-banner').textContent,new RegExp(open.length+' Quick Assessment questions are still unanswered'));
  assert.notEqual($('output[data-line="9"]').textContent,'—');
 }finally{dom.window.close();Object.assign(global,previous);}
});

test('calculated lines show their formula with current amounts and update after each edit',async()=>{
 const answers=complete({reviewW2:'Yes',reviewBusiness:'Yes'});
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 global.fetch=async(url,options={})=>({ok:true,status:200,json:async()=>({answers,step:0,updated:null,draft:draft(answers)})});
 const $=s=>document.querySelector(s);const type=(el,v)=>{el.value=v;el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 try{
  await import('../public/app.js?formulas');await new Promise(r=>setTimeout(r,30));
  const fx=ref=>$(`.fx[data-fx="${ref}"]`),panel=ref=>fx(ref).closest('.line').querySelector('.formula');
  assert.equal(fx('1040:1a').hidden,true);assert.equal(fx('1040:9').hidden,false);assert.equal(fx('1040:8').hidden,false);assert.equal(fx('1040:16').hidden,false);
  assert.equal(panel('1040:9').hidden,true);fx('1040:9').click();assert.equal(panel('1040:9').hidden,false);
  assert.match(panel('1040:9').textContent,/^Line 9 = line 1z \(\$55,000\) \+ line 2b \(\$0\).*line 8 \(\$30,000\) = \$85,000$/);
  fx('1040:8').click();assert.equal(panel('1040:8').textContent,'Line 8 = Schedule 1 line 10 ($30,000) = $30,000');
  fx('c:31').click();assert.equal(panel('c:31').textContent,'Line 31 = line 29 ($30,000) − line 30 ($0) = $30,000');
  fx('1040:16').click();assert.match(panel('1040:16').textContent,/^Line 16 = 2025 Single tax rates applied to line 15 \(\$\d/);
  type($('#f-c-1'),'60000');
  assert.equal(panel('c:31').textContent,'Line 31 = line 29 ($50,000) − line 30 ($0) = $50,000');
  assert.match(panel('1040:9').textContent,/line 8 \(\$50,000\) = \$105,000$/);
  const ref=[...panel('1040:8').querySelectorAll('.ref')][0];ref.dispatchEvent(new dom.window.Event('mouseenter'));
  assert.ok($('[data-form="1"] [data-row="10"]').classList.contains('hl'));ref.dispatchEvent(new dom.window.Event('mouseleave'));
  type($('#tax'),'5000');assert.equal(fx('1040:16').hidden,true);
  $('#show-all-calcs').click();
  assert.equal(document.querySelectorAll('.formula:not([hidden])').length,document.querySelectorAll('.fx:not([hidden])').length);
  assert.ok(document.querySelectorAll('.formula:not([hidden])').length>30);
 }finally{await new Promise(r=>setTimeout(r,600));dom.window.close();Object.assign(global,previous);}
});
