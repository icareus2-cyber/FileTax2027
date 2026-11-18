import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {PDFDocument} from 'pdf-lib';
import {isLocal} from '../public/storage.js';
// A static host has no /api: it answers 404, or the index page for single-page fallbacks.
for(const [name,reply] of [['404',{ok:false,status:404,headers:new Headers({'content-type':'text/html'})}],['HTML fallback',{ok:true,status:200,headers:new Headers({'content-type':'text/html'})}]])
test(`on a static host (${name}) drafts save in localStorage and the PDF is drawn in the page`,async()=>{
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://example.github.io/filetax/'});
 const previous={window:global.window,document:global.document,fetch:global.fetch,localStorage:global.localStorage,createObjectURL:URL.createObjectURL};
 global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;
 localStorage.setItem('filetax-draft-v1',JSON.stringify({answers:{wages:50000},step:0,updated:'2026-01-01T00:00:00.000Z'}));
 const calls=[];global.fetch=async url=>{calls.push(url);return {...reply,json:async()=>{throw SyntaxError('Unexpected token <');}};};
 let blob;URL.createObjectURL=b=>{blob=b;return 'blob:x';};dom.window.HTMLAnchorElement.prototype.click=()=>{};
 try{
  await import('../public/app.js?static'+name);await new Promise(r=>setTimeout(r,30));
  assert.equal(isLocal(),true);assert.equal(document.getElementById('save-status').textContent,'Saved draft restored');
  const input=document.getElementById('wages');assert.equal(input.value,'50000');
  input.value='64000';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,600));
  assert.equal(JSON.parse(localStorage.getItem('filetax-draft-v1')).answers.wages,64000);
  assert.equal(document.getElementById('save-status').textContent,'All changes saved');
  await document.getElementById('download').onclick();
  assert.equal(document.getElementById('error').hidden,true);
  assert.equal(blob.type,'application/pdf');
  const pdf=await PDFDocument.load(await blob.arrayBuffer());assert.match(pdf.getTitle(),/Form 1040 template/);
  assert.deepEqual(calls,['/api/return']);
 }finally{dom.window.close();URL.createObjectURL=previous.createObjectURL;Object.assign(global,{window:previous.window,document:previous.document,fetch:previous.fetch,localStorage:previous.localStorage});}
});
