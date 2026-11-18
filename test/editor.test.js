import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {draft} from '../tax.js';
test('1040 form updates calculated lines before saving, blocks invalid inputs, and saves the latest edit',async()=>{
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 let stored={wages:50000,otherWages:0,interest:0,dividends:0,ira:0,pension:0,ss:0,gains:0,additionalIncome:0};
 const writes=[];
 global.fetch=async(url,options={})=>{if(options.method==='PUT'){stored=JSON.parse(options.body).answers;writes.push(stored.wages);}return {ok:true,status:200,json:async()=>({answers:stored,step:0,updated:null,draft:draft(stored)})};};
 try{
  await import('../public/app.js?editor');await new Promise(r=>setTimeout(r,30));
  const line9=()=>document.querySelector('output[data-line="9"]').textContent;
  assert.match(line9(),/\$50,000/);
  const input=document.getElementById('wages');
  const edit=value=>{input.value=value;input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
  edit('60000');assert.match(line9(),/\$60,000/);
  edit('-1');assert.equal(document.getElementById('error').hidden,false);assert.equal(line9(),'—');
  edit('70000');edit('75000');assert.match(line9(),/\$75,000/);
  await new Promise(r=>setTimeout(r,600));assert.deepEqual(writes,[75000]);assert.equal(document.getElementById('error').hidden,true);
  assert.equal(document.getElementById('deduction').readOnly,true);
 }finally{dom.window.close();Object.assign(global,previous);}
});
