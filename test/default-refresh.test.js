import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {seedExamples} from '../public/examples.js';
import {draft} from '../tax.js';
test('quick assessment answers save and older hypothetical examples are removed',async()=>{
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 let stored=seedExamples({reviewBusiness:'Yes',reviewCompleted:'Yes'});
 assert.equal(stored.strategyBusinessReceipts,10000);
 global.fetch=async(url,options={})=>{if(options.method==='PUT')stored=JSON.parse(options.body).answers;return {ok:true,status:200,json:async()=>({answers:stored,step:0,updated:null,draft:draft(stored)})};};
 try{
  await import('../public/app.js?refresh');await new Promise(r=>setTimeout(r,30));
  assert.equal(document.getElementById('reviewBusiness-0').checked,true);
  const help=document.querySelector('[aria-controls="reviewRental-help"]');assert.equal(document.getElementById('reviewRental-help').hidden,true);help.click();assert.equal(document.getElementById('reviewRental-help').hidden,false);assert.equal(help.getAttribute('aria-expanded'),'true');
  assert.equal(document.querySelectorAll('#assessment .help').length,document.querySelectorAll('#assessment .assess-q').length);
  document.getElementById('reviewRental-0').click();
  assert.match(document.getElementById('review-notes').textContent,/rental/i);
  await new Promise(r=>setTimeout(r,600));
  assert.equal(stored.reviewRental,'Yes');assert.equal(stored.strategyBusinessReceipts,undefined);
 }finally{dom.window.close();Object.assign(global,previous);}
});
