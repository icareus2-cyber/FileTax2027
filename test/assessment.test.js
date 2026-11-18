import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {assessment,pruneAssessment,screeningNotes} from '../public/screening.js';
import {validate} from '../public/base-tax.js';
import {draft} from '../tax.js';
const rows=a=>Object.fromEntries(assessment(a).flatMap(g=>g.items).map(q=>[q.key,q.rows.map(r=>r.key)]));
test('marital answers decide whether per-person questions are asked for each spouse',()=>{
 assert.equal(rows({}).reviewJoint,undefined);
 assert.deepEqual(rows({}).reviewW2,['reviewW2']);
 assert.deepEqual(rows({quickMarried:'Yes'}).reviewJoint,['reviewJoint']);
 assert.deepEqual(rows({quickMarried:'Yes'}).reviewW2,['reviewW2']);
 assert.deepEqual(rows({quickMarried:'Yes',reviewJoint:'Yes, jointly with my spouse'}).reviewW2,['reviewW2','reviewW2Spouse']);
 assert.deepEqual(rows({quickMarried:'Yes',reviewJoint:'Not sure / skip'}).reviewSocialSecurity,['reviewSocialSecurity','reviewSocialSecuritySpouse']);
 assert.deepEqual(rows({quickMarried:'Yes',reviewJoint:'No'}).reviewW2,['reviewW2']);
 assert.equal(rows({quickMarried:'No',reviewJoint:'Yes, jointly with my spouse'}).reviewJoint,undefined);
});
test('follow-up questions depend on earlier answers for the right person',()=>{
 const joint={quickMarried:'Yes',reviewJoint:'Yes, jointly with my spouse'};
 assert.equal(rows(joint).quickBusinessReceiptsHigh,undefined);
 assert.deepEqual(rows({...joint,reviewBusinessSpouse:'Yes'}).quickBusinessReceiptsHigh,['quickBusinessReceiptsHighSpouse']);
 assert.deepEqual(rows({...joint,reviewBusiness:'Yes',reviewBusinessSpouse:'Yes'}).quickBusinessReceiptsHigh,['quickBusinessReceiptsHigh','quickBusinessReceiptsHighSpouse']);
 assert.equal(rows({}).quickRentalKind,undefined);
 assert.ok(rows({reviewRental:'Yes'}).planRentalGrossHigh);
 assert.equal(rows({reviewRental:'Yes',quickRentalKind:'Royalties'}).planRentalGrossHigh,undefined);
 assert.equal(rows({}).reviewCare,undefined);
 assert.ok(rows({quickFamily:'Yes'}).reviewCare);
 assert.equal(rows({quickFamily:'Yes',reviewW2:'No',reviewBusiness:'No'}).reviewCare,undefined);
 assert.ok(rows({...joint,quickFamily:'Yes',reviewW2:'No',reviewBusiness:'No',reviewW2Spouse:'Yes'}).reviewCare);
});
test('answers to questions that stop applying are removed, including chained follow-ups',()=>{
 const a={quickMarried:'Yes',reviewJoint:'Yes, jointly with my spouse',reviewW2Spouse:'Yes',reviewBusinessSpouse:'Yes',quickBusinessReceiptsHighSpouse:'No',reviewRental:'Yes',quickRentalKind:'Rent from one property',planRentalGrossHigh:'No',quickFamily:'Yes',reviewCare:'Yes'};
 assert.deepEqual(pruneAssessment(a),a);
 const separate=pruneAssessment({...a,reviewJoint:'No'});
 for(const k of ['reviewW2Spouse','reviewBusinessSpouse','quickBusinessReceiptsHighSpouse'])assert.equal(separate[k],undefined,k);
 const single=pruneAssessment({...a,quickMarried:'No',reviewRental:'No'});
 for(const k of ['reviewJoint','reviewW2Spouse','quickRentalKind','planRentalGrossHigh'])assert.equal(single[k],undefined,k);
 assert.equal(single.reviewCare,'Yes');
 assert.equal(pruneAssessment({reviewJoint:'Yes, jointly with my spouse'}).quickMarried,'Yes');
});
test('spouse answers are saved and drive review notes',()=>{
 const a={quickMarried:'Yes',reviewJoint:'Yes, jointly with my spouse',reviewW2:'Yes',reviewBusinessSpouse:'Yes',status:'Single'};
 assert.equal(validate(a).reviewBusinessSpouse,'Yes');
 const notes=screeningNotes(a).join('\n');
 assert.match(notes,/Schedule SE/);assert.match(notes,/Both spouses have earned income/);assert.match(notes,/file jointly, but Form 1040 filing status is Single/);
 assert.doesNotMatch(screeningNotes({...a,reviewJoint:'No'}).join('\n'),/Schedule SE/);
 assert.match(screeningNotes({quickMarried:'No',status:'Married filing jointly'}).join('\n'),/not married/);
});
test('assessment panel splits and collapses questions as answers change',async()=>{
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 let stored={};
 global.fetch=async(url,options={})=>{if(options.method==='PUT')stored=JSON.parse(options.body).answers;return {ok:true,status:200,json:async()=>({answers:stored,step:0,updated:null,draft:draft(stored)})};};
 const $=s=>document.querySelector(s);
 try{
  await import('../public/app.js?assessment');await new Promise(r=>setTimeout(r,30));
  assert.equal($('#reviewJoint-0'),null);assert.equal($('#reviewW2Spouse-0'),null);
  $('#quickMarried-0').click();assert.ok($('#reviewJoint-0'));
  assert.equal($('#reviewJoint-1').parentElement.textContent,'Separately');
  $('#reviewJoint-0').click();
  assert.ok($('#reviewW2Spouse-0'));assert.match($('[data-question="reviewW2"]').textContent,/each of you.*You.*Spouse/s);
  $('#reviewW2Spouse-0').click();$('#reviewBusinessSpouse-0').click();
  assert.ok($('#quickBusinessReceiptsHighSpouse-0'));assert.equal($('#quickBusinessReceiptsHigh-0'),null);
  $('#reviewJoint-1').click();
  assert.equal($('#reviewW2Spouse-0'),null);assert.equal($('#quickBusinessReceiptsHighSpouse-0'),null);
  await new Promise(r=>setTimeout(r,600));
  assert.equal(stored.reviewJoint,'No');assert.equal(stored.reviewW2Spouse,undefined);assert.equal(stored.quickMarried,'Yes');
 }finally{dom.window.close();Object.assign(global,previous);}
});
