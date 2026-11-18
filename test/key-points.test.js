import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {keyPoints,marginalRate} from '../public/key-points.js';
import {buildReturn} from '../public/template.js';
import {TaxReturn} from '../public/return-model.js';
import {draft} from '../tax.js';
import {complete} from './helpers.js';
const points=a=>{const b=buildReturn(a);return keyPoints(a,b,new TaxReturn(b.merged).snapshot().lines);};
const titles=kp=>kp.strategies.map(s=>s.title);
test('marginal rate follows the year and filing status brackets',()=>{
 assert.equal(marginalRate(0,'Single',2025),0);assert.equal(marginalRate(11925,'Single',2025),.10);assert.equal(marginalRate(11926,'Single',2025),.12);
 assert.equal(marginalRate(96000,'Married filing jointly',2025),.12);assert.equal(marginalRate(12000,'Single',2026),.10);assert.equal(marginalRate(900000,'Single',2026),.37);
});
test('summary reflects the answers and the return',()=>{
 const kp=points(complete({reviewUSHome:'Yes',reviewW2:'Yes',reviewBusiness:'Yes'}));
 const fact=k=>kp.facts.find(f=>f[0]===k)?.[1];
 assert.equal(fact('Tax year'),'2025');assert.equal(fact('Filing status'),'Single (suggested by your answers)');
 assert.equal(fact('Total income (line 9)'),'$85,000');assert.equal(fact('Tax bracket'),'22%');
 assert.deepEqual(kp.income,['Wages — you: $55,000','Self-employment — you: $30,000']);
 assert.deepEqual(kp.forms,['Schedule 1','Schedule 2','Schedule C','Schedule SE','Form 8995']);
 assert.match(kp.cautions[0],/template values/);
});
test('strategies match the situation, with estimated savings sorted first',()=>{
 const base=points(complete({reviewUSHome:'Yes'}));assert.deepEqual(titles(base),[]);
 const se=points(complete({reviewUSHome:'Yes',reviewBusiness:'Yes'}));
 assert.ok(titles(se).includes('Open a SEP-IRA or solo 401(k)'));assert.ok(!titles(se).includes('Make quarterly estimated payments'),'template already has estimated payments');
 assert.ok(titles(points({...complete({reviewUSHome:'Yes',reviewBusiness:'Yes'}),estimated:0})).includes('Make quarterly estimated payments'));
 const sep=se.strategies.find(s=>s.title==='Open a SEP-IRA or solo 401(k)');assert.match(sep.action,/about \$5,576 here/);assert.match(sep.saving,/about \$\d/);
 for(let i=1;i<se.strategies.length;i++)assert.ok(se.strategies[i-1].amount>=se.strategies[i].amount);
 const fam=points(complete({reviewUSHome:'Yes',reviewW2:'Yes',quickFamily:'Yes',reviewCare:'Yes'}));
 assert.ok(titles(fam).includes('Use a dependent care FSA'));assert.ok(titles(fam).includes('Claim the child tax credit for every qualifying child'));
 assert.ok(!titles(fam).includes('Check head of household status'),'already head of household');
 const single=points({...complete({reviewUSHome:'Yes',reviewW2:'Yes',quickFamily:'Yes'}),status:'Single'});assert.ok(titles(single).includes('Check head of household status'));
 const mfs=points(complete({reviewUSHome:'Yes',quickMarried:'Yes',reviewJoint:'No'}));assert.ok(titles(mfs).includes('Compare joint and separate returns'));
 const inv=points(complete({reviewUSHome:'Yes',reviewBroker:'Yes'}));assert.ok(titles(inv).includes('Harvest gains at 0%'));
 const rich=points({...complete({reviewUSHome:'Yes',reviewW2:'Yes',reviewBroker:'Yes'}),wages:400000});assert.ok(titles(rich).includes('Harvest losses and hold for the long term'));
 assert.ok(titles(points(complete({reviewUSHome:'Yes',quickForeign:'Yes'}))).includes('Claim the foreign tax credit'));
 assert.ok(titles(points(complete({reviewUSHome:'Yes',reviewRental:'Yes'}))).includes('Depreciate the rental and track every expense'));
 assert.ok(titles(points(complete({reviewUSHome:'Yes',reviewRetired:'Yes'}))).includes('Plan retirement withdrawals'));
});
test('year-specific limits and rules change with the tax year',()=>{
 const a=complete({reviewUSHome:'Yes',reviewW2:'Yes',quickHomeCosts:'Yes'});
 const y25=points(a),y26=points({...a,taxYear:'2026'});
 const k401=kp=>kp.strategies.find(s=>s.title==='Raise workplace retirement contributions').action;
 assert.match(k401(y25),/\$23,500 per person for 2025/);assert.match(k401(y26),/\$24,500 per person for 2026/);
 assert.ok(titles(y25).includes('Claim home energy credits before they end'));assert.ok(!titles(y26).includes('Claim home energy credits before they end'));
 const std=points({...complete({reviewUSHome:'Yes',reviewW2:'Yes'}),taxYear:'2026'});assert.ok(titles(std).includes('Deduct cash gifts without itemizing'));
 assert.ok(!titles(points(complete({reviewUSHome:'Yes',reviewW2:'Yes'}))).includes('Deduct cash gifts without itemizing'));
});
test('the Key Points tab shows the summary and updates as the form changes',async()=>{
 const answers=complete({reviewUSHome:'Yes',reviewW2:'Yes',reviewBusiness:'Yes'});
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 global.fetch=async()=>({ok:true,status:200,json:async()=>({answers,step:0,updated:null,draft:draft(answers)})});
 const $=s=>document.querySelector(s);
 try{
  await import('../public/app.js?keypoints');await new Promise(r=>setTimeout(r,30));
  assert.equal($('#tab-assess').getAttribute('aria-selected'),'true');assert.equal($('#key-points'),null);
  $('#tab-keys').click();
  assert.equal($('#tab-keys').getAttribute('aria-selected'),'true');assert.ok($('#key-points'));assert.equal($('[data-question]'),null);
  assert.match($('.kp-facts').textContent,/Total income \(line 9\)\$85,000/);
  assert.ok([...document.querySelectorAll('.kp-card h4')].some(h=>h.textContent==='Open a SEP-IRA or solo 401(k)'));
  const w=$('#wages');w.value='200000';w.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  assert.match($('.kp-facts').textContent,/Total income \(line 9\)\$230,000/);assert.match($('.kp-facts').textContent,/Tax bracket32%/);
  $('#tab-assess').click();assert.ok($('[data-question="reviewW2"]'));assert.equal($('#key-points'),null);
 }finally{await new Promise(r=>setTimeout(r,600));dom.window.close();Object.assign(global,previous);}
});
