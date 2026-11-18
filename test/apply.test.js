import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {applyBenefit,removeBenefit,optionAmount} from '../public/apply.js';
import {keyPoints} from '../public/key-points.js';
import {buildReturn} from '../public/template.js';
import {TaxReturn} from '../public/return-model.js';
import {validate} from '../public/base-tax.js';
import {draft} from '../tax.js';
import {complete} from './helpers.js';
const lines=a=>new TaxReturn(buildReturn(a).merged).snapshot().lines;
const strat=(a,title)=>{const b=buildReturn(a);return {b,s:keyPoints(a,b,lines(a)).strategies.find(s=>s.title===title)};};
test('applied benefits write to the right line and can be undone exactly',()=>{
 const a=complete({reviewUSHome:'Yes',reviewW2:'Yes',reviewBusiness:'Yes'});
 // Traditional IRA: sets Schedule 1 line 20, which flows to Form 1040 line 10.
 let {b,s}=strat(a,'Contribute to a traditional IRA');const ira=s.apply.find(o=>o.id==='trad-ira');
 let next=applyBenefit(a,b,s,ira,5000);
 assert.equal(next._forms['1']['20'],5000);assert.equal(lines(next)['10'],lines(a)['10']+5000);
 assert.deepEqual(next._applied.map(r=>[r.option,r.amount,r.target]),[['trad-ira',5000,'form:1:20']]);
 assert.equal(validate(next)._applied.length,1);
 const back=removeBenefit(next,0);assert.equal(back._forms?.['1']?.['20'],undefined);assert.equal(back._applied,undefined);assert.equal(lines(back)['10'],lines(a)['10']);
 // 401(k): subtracts from template wages, and removal restores the template.
 ({b,s}=strat(a,'Raise workplace retirement contributions'));
 next=applyBenefit(a,b,s,s.apply[0],10000);assert.equal(next.wages,45000);
 assert.equal(removeBenefit(next,0).wages,undefined);
 next=applyBenefit({...a,wages:70000},b,s,s.apply[0],10000);assert.equal(next.wages,60000);assert.equal(removeBenefit(next,0).wages,70000);
 // Applying the same option again replaces, not stacks.
 next=applyBenefit(applyBenefit(a,b,s,s.apply[0],10000),b,s,s.apply[0],4000);assert.equal(next.wages,51000);assert.equal(next._applied.length,1);
 // Limits and conversions.
 assert.equal(optionAmount(s.apply[0],999999),23500+7500);
 ({b,s}=strat(a,'Claim every business deduction'));
 const home=s.apply.find(o=>o.id==='home-office');assert.equal(optionAmount(home,400),1500);
 next=applyBenefit(a,b,s,home,200);assert.equal(next._forms.c['30'],1000);
 const miles=s.apply.find(o=>o.id==='mileage');next=applyBenefit(a,b,s,miles,1000);assert.equal(next._forms.c['28'],10000+700);
});
test('status and Schedule 3 benefits, and records that only note a choice',()=>{
 const a={...complete({reviewUSHome:'Yes',reviewW2:'Yes',quickFamily:'Yes',quickForeign:'Yes'}),status:'Single'};
 let {b,s}=strat(a,'Check head of household status');
 let next=applyBenefit(a,b,s,s.apply[0]);assert.equal(next.status,'Head of household');assert.equal(removeBenefit(next,0).status,'Single');
 ({b,s}=strat(a,'Claim the foreign tax credit'));
 next=applyBenefit(a,b,s,s.apply[0],250);assert.equal(next._forms['3']['1'],250);
 const s3=buildReturn(next).forms.find(f=>f.id==='3');assert.ok(s3,'Schedule 3 is added when a credit is entered');assert.equal(s3.lines.find(l=>l.line==='8').value,250);
 assert.equal(lines(next)['20'],Math.min(250,lines(next)['18']-lines(next)['19']),'line 20 is limited by the tax left after line 19');
 const roth=strat(complete({reviewUSHome:'Yes',reviewIRA:'Yes'}),'Consider a Roth IRA');
 if(roth.s){next=applyBenefit(a,roth.b,roth.s,roth.s.apply[0],3000);assert.equal(next._applied[0].mode,'note');assert.equal(next._forms,undefined);}
 assert.throws(()=>validate({_applied:[{strategy:'x',option:'y',label:'z',mode:'set',target:'../etc'}]}),/Invalid applied/);
});
test('the Apply window previews the effect, fills the form, and lists the applied item',async()=>{
 const answers=complete({reviewUSHome:'Yes',reviewW2:'Yes',reviewBusiness:'Yes'});let stored=answers;
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 global.fetch=async(url,options={})=>{if(options.method==='PUT')stored=JSON.parse(options.body).answers;return {ok:true,status:200,json:async()=>({answers:stored,step:0,updated:null,draft:draft(stored)})};};
 const $=s=>document.querySelector(s);const type=(el,v)=>{el.value=v;el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 try{
  await import('../public/app.js?apply');await new Promise(r=>setTimeout(r,30));
  $('#tab-keys').click();
  const card=$('[data-strategy="contribute-to-a-traditional-ira"]');assert.ok(card);
  const taxBefore=$('output[data-line="24"]').textContent;
  card.querySelector('.kp-apply').click();
  assert.ok($('#apply-dialog'));assert.equal($('#apply-opt-0').checked,true);assert.equal($('#apply-confirm').disabled,true);
  type($('#apply-value'),'6000');
  assert.match($('.apply-hint').textContent,/Goes to Schedule 1, line 20/);assert.match($('.apply-preview').textContent,/Effect: total tax .* → .*saves \$1,320/);
  $('#apply-confirm').click();
  assert.equal($('#apply-dialog'),null);
  assert.equal($('#f-1-20').value,'6000');assert.equal($('#adjustments').value,String(6000+2119));
  assert.notEqual($('output[data-line="24"]').textContent,taxBefore);
  assert.match($('.kp-applied').textContent,/Deductible traditional IRA contribution\$6,000 → Schedule 1, line 20/);
  assert.match($('[data-strategy="contribute-to-a-traditional-ira"] .kp-done')?.textContent??'',/Applied/);
  await new Promise(r=>setTimeout(r,600));assert.equal(stored._forms['1']['20'],6000);assert.equal(stored._applied[0].option,'trad-ira');
  $('.kp-remove').click();assert.equal($('.kp-applied'),null);assert.equal($('output[data-line="24"]').textContent,taxBefore);
  // Status option: no amount needed; Escape closes without changes.
  $('[data-strategy="open-a-sep-ira-or-solo-401-k"] .kp-apply').click();document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));assert.equal($('#apply-dialog'),null);
 }finally{await new Promise(r=>setTimeout(r,600));dom.window.close();Object.assign(global,previous);}
});
