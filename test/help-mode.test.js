import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {draft} from '../tax.js';
import {complete} from './helpers.js';
import {fieldHelp,formHelp} from '../public/field-help.js';
import {sections} from '../public/questions.js';
import {formDefs} from '../public/form-defs.js';
test('every Form 1040 field and every typed schedule line has help text',()=>{
 for(const [key] of sections.flatMap(s=>s.fields))assert.ok(fieldHelp[key],key);
 for(const [id,def] of Object.entries(formDefs))for(const l of def.lines)if(l.kind)assert.ok(formHelp[`${id}:${l.line}`],`${id}:${l.line}`);
});
test('help mode explains the field under the pointer and a left click exits without changing the form',async()=>{
 const answers=complete({reviewW2:'Yes',reviewBusiness:'Yes'});
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 global.fetch=async()=>({ok:true,status:200,json:async()=>({answers,step:0,updated:null,draft:draft(answers)})});
 const $=s=>document.querySelector(s),tip=()=>$('#help-tip');
 const hover=el=>el.dispatchEvent(new dom.window.MouseEvent('mouseover',{bubbles:true,clientX:100,clientY:100}));
 try{
  await import('../public/app.js?help');await new Promise(r=>setTimeout(r,30));
  hover($('#wages'));assert.equal(tip().hidden,true,'no help until the mode is on');
  $('#help-mode').click();
  assert.ok(document.body.classList.contains('help-mode'));assert.equal($('#help-mode').getAttribute('aria-pressed'),'true');
  hover($('#wages'));assert.equal(tip().hidden,false);
  assert.match(tip().textContent,/Form 1040, line 1a/);assert.match(tip().textContent,/box 1 .*Form W-2/);assert.match(tip().textContent,/template value/);
  assert.ok($('[data-row="1a"]').classList.contains('help-target'));
  hover($('#f-c-1'));assert.match(tip().textContent,/Schedule C, line 1/);assert.match(tip().textContent,/1099-NEC/);
  hover($('[data-form="c"] [data-row="31"] output'));assert.match(tip().textContent,/Calculated automatically/);assert.match(tip().textContent,/= line 29 \(\$30,000\) − line 30 \(\$0\) = \$30,000/);
  hover($('output[data-line="9"]'));assert.match(tip().textContent,/= line 1z \(\$55,000\)/);
  hover($('#additionalIncome'));assert.match(tip().textContent,/Filled automatically — from Schedule 1, line 10/);
  hover($('#interest'));assert.match(tip().textContent,/bank year-end statement/);
  hover($('[data-question="reviewW2"] .assess-label'));assert.match(tip().textContent,/Form W-2/);
  hover($('#status-2'));assert.match(tip().textContent,/Filing Status/);
  // A left click exits help mode and is swallowed: the radio under it is not selected.
  const radio=$('#status-2');assert.equal(radio.checked,false);
  radio.dispatchEvent(new dom.window.MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));radio.click();
  assert.equal(document.body.classList.contains('help-mode'),false);assert.equal(tip().hidden,true);assert.equal(radio.checked,false);
  assert.equal($('.help-target'),null);
  hover($('#wages'));assert.equal(tip().hidden,true);
  radio.click();assert.equal(radio.checked,true,'clicks work normally after exiting');
  $('#help-mode').click();document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(document.body.classList.contains('help-mode'),false);
 }finally{await new Promise(r=>setTimeout(r,600));dom.window.close();Object.assign(global,previous);}
});
