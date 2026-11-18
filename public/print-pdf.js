// Draws the on-screen Form 1040 template and its schedules as a PDF. The browser sends what it
// shows (labels, amounts, and whether each box is the user's figure, a template figure, or
// calculated); nothing here depends on an official IRS PDF, so every tax year can be printed.
// Shared by the Node server and the browser, so the pdf-lib build is passed in rather than imported.
const states=['user','template','auto','form','calc','text'];
// Standard PDF fonts use WinAnsi encoding; map the few characters the page uses outside it.
const winAnsi=new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ']);
const clean=s=>[...String(s??'')].map(c=>c==='−'?'-':c==='→'?'->':c==='≤'?'<=':c==='≥'?'>=':c.charCodeAt(0)<127&&c.charCodeAt(0)>31||c.charCodeAt(0)>=160&&c.charCodeAt(0)<=255||winAnsi.has(c)?c:'?').join('');
const bad=()=>Object.assign(Error('Invalid form snapshot'),{status:400});
const str=(v,max=400)=>{if(v===undefined||v===null)return '';if(typeof v!=='string'||v.length>max)throw bad();return v;};
const list=(v,max)=>{if(!Array.isArray(v)||v.length>max)throw bad();return v;};
function rows(v){return list(v,200).map(r=>{if(!r||typeof r!=='object')throw bad();const state=str(r.state,10)||'text';if(!states.includes(state))throw bad();return {line:str(r.line,12),label:str(r.label),value:str(r.value,60),state,strong:r.strong===true,heading:r.heading===true};});}
export function checkSnapshot(doc){
 if(!doc||typeof doc!=='object')throw bad();
 if(!['2025','2026'].includes(doc.year))throw bad();
 return {year:doc.year,notice:str(doc.notice,600),identity:list(doc.identity??[],12).map(p=>[str(p?.[0],120),str(p?.[1],200)]),
  checks:list(doc.checks??[],12).map(c=>({title:str(c?.title,60),question:str(c?.question),answer:str(c?.answer,80),template:c?.template===true})),
  rows:rows(doc.rows??[]),forms:list(doc.forms??[],24).map(f=>({title:str(f?.title,60),subtitle:str(f?.subtitle,160),stamp:str(f?.stamp,40),rows:rows(f?.rows??[])}))};
}
export function printer({PDFDocument,StandardFonts,rgb}){
 const fill={template:rgb(1,.957,.839),auto:rgb(.933,.957,1),form:rgb(.918,.941,.984),calc:rgb(1,1,1),user:rgb(.969,.98,1),text:rgb(1,1,1)};
 return async function makePrintPdf(input){
  const doc=checkSnapshot(input),pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),italic=await pdf.embedFont(StandardFonts.HelveticaOblique);
  pdf.setTitle(`Form 1040 template ${doc.year}`);pdf.setCreator('FileTax');
  const W=612,H=792,M=36,ink=rgb(.07,.07,.07),rule=rgb(.35,.35,.35),soft=rgb(.72,.72,.72),amber=rgb(.48,.32,0);
  let page,y;
  const newPage=()=>{page=pdf.addPage([W,H]);y=H-M;};
  const need=h=>{if(y-h<M+18)newPage();};
  const text=(s,x,yy,size=9,f=font,color=ink)=>page.drawText(clean(s),{x,y:yy,size,font:f,color});
  const fit=(s,width,size,f=font)=>{s=clean(s);if(f.widthOfTextAtSize(s,size)<=width)return [s];const words=s.split(' '),out=[''];for(const w of words){const t=(out.at(-1)?out.at(-1)+' ':'')+w;if(f.widthOfTextAtSize(t,size)<=width)out[out.length-1]=t;else out.push(w);}return out.slice(0,3);};
  const header=(title,subtitle,right,stamp)=>{
   need(60);page.drawRectangle({x:M,y:y-40,width:W-2*M,height:40,borderColor:ink,borderWidth:1.2});
   text(title,M+8,y-26,16,bold);text(subtitle,M+150,y-18,10.5,bold);
   if(stamp)text(stamp,M+150,y-32,8,bold,amber);
   if(right)text(right,W-M-bold.widthOfTextAtSize(right,20)-10,y-28,20,bold);
   y-=44;
  };
  const row=r=>{
   if(r.heading){need(20);page.drawRectangle({x:M,y:y-16,width:W-2*M,height:16,color:rgb(.93,.93,.93)});text(r.label,M+6,y-12,9.5,bold);y-=18;return;}
   const f=r.strong?bold:font,label=fit(r.label,W-2*M-44-128-12,8.5,f),h=Math.max(16,label.length*10+5);need(h);
   page.drawLine({start:{x:M,y:y-h},end:{x:W-M,y:y-h},thickness:.4,color:soft});
   text(r.line,M+4,y-11,8.5,bold);label.forEach((l,i)=>text(l,M+44,y-11-i*10,8.5,f));
   if(r.value!==''||r.state!=='text'){
    const bx=W-M-128;page.drawRectangle({x:bx,y:y-h+1,width:128,height:h-2,color:fill[r.state],borderColor:rule,borderWidth:.5});
    const v=clean(r.value),vf=r.state==='template'||r.state==='auto'?italic:r.strong||r.state==='calc'?bold:font;
    text(v,W-M-6-vf.widthOfTextAtSize(v,9),y-12,9,vf,r.state==='template'?amber:ink);
   }
   y-=h;
  };
  newPage();
  header('Form 1040','U.S. Individual Income Tax Return',doc.year,doc.notice?'TEMPLATE FIGURES INCLUDED':'');
  for(const l of fit('Printed from FileTax. Not an official IRS form and not for filing. '+doc.notice,W-2*M,8))need(11),text(l,M,y-9,8,italic,rgb(.3,.3,.3)),y-=11;
  y-=4;
  for(const [label,value] of doc.identity){need(22);page.drawRectangle({x:M,y:y-22,width:W-2*M,height:22,borderColor:soft,borderWidth:.5});text(label,M+4,y-8,6.5,font,rgb(.35,.35,.35));text(value||' ',M+4,y-18,9.5);y-=22;}
  y-=4;
  for(const c of doc.checks){const q=fit(c.question,W-2*M-110-150,8);const h=Math.max(16,q.length*10+5);need(h);text(c.title,M+4,y-11,8.5,bold);q.forEach((l,i)=>text(l,M+110,y-11-i*10,8));text(c.answer,W-M-150,y-11,8.5,c.template?italic:bold,c.template?amber:ink);page.drawLine({start:{x:M,y:y-h},end:{x:W-M,y:y-h},thickness:.4,color:soft});y-=h;}
  y-=6;
  doc.rows.forEach(row);
  for(const f of doc.forms){if(y<260)newPage();else y-=14;header(f.title,f.subtitle,doc.year,f.stamp);f.rows.forEach(row);}
  // Legend and page numbers.
  const pages=pdf.getPages();
  pages.forEach((p,i)=>{p.drawText(clean(`Form 1040 template ${doc.year} - page ${i+1} of ${pages.length}   Shaded amber: template figure  Blue: calculated or carried from another form`),{x:M,y:18,size:7,font,color:rgb(.4,.4,.4)});});
  return pdf.save();
 };
}
