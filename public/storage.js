import {validate} from './base-tax.js';
// Drafts save through the local Node server when it answers /api; on a static host (no server)
// they stay in this browser's localStorage and the PDF is drawn in the page instead.
const KEY='filetax-draft-v1';
let local=false;
async function request(url,options){const r=await fetch(url,options);if(!r.ok){const e=await r.json();throw Error(e.error||'Unable to connect.');}return r.status===204?null:r.json();}
// A static host answers /api with a 404 or (for single-page fallbacks) an HTML page.
async function serverDraft(){
 try{
  const r=await fetch('/api/return');const type=r.headers?.get?.('content-type');
  if(!r.ok||type&&!type.includes('json'))return null;
  const data=await r.json();return data&&typeof data.answers==='object'?data:null;
 }catch{return null;}
}
function localDraft(){
 try{const s=JSON.parse(localStorage.getItem(KEY));if(s?.answers&&typeof s.answers==='object')return {answers:s.answers,step:s.step??0,updated:s.updated??null};}catch{}
 return {answers:{},step:-1,updated:null};
}
export const isLocal=()=>local;
export async function loadDraft(){
 local=false;const data=await serverDraft();if(data)return data;
 local=true;return localDraft();
}
export async function saveDraft(payload){
 if(!local)return request('/api/return',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const answers=validate(payload.answers),step=payload.step;
 if(!Number.isInteger(step)||step< -1||step>6)throw Error('Invalid interview step');
 const saved={answers,step,updated:new Date().toISOString()};
 try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{throw Error('This browser blocked saving (private window or storage full). Edits remain on this page only.');}
 return saved;
}
// Returns the printable PDF as a Blob.
export async function printPdf(doc){
 if(!local){
  const r=await fetch('/api/print',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({doc})});
  if(!r.ok){const e=await r.json();throw Error(e.error||'Unable to generate PDF');}
  return r.blob();
 }
 const [lib,{printer}]=await Promise.all([import('./vendor/pdf-lib.esm.min.js'),import('./print-pdf.js')]);
 return new Blob([await printer(lib)(doc)],{type:'application/pdf'});
}
