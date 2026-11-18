import {makeFormPdf,makePacket} from './form-pdf.js';
import express from 'express';
import Database from 'better-sqlite3';
import {randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validate,draft} from './tax.js';
import {makePdf} from './pdf.js';
import {makePrintPdf} from './print-pdf.js';
const root=fileURLToPath(new URL('.',import.meta.url));
mkdirSync(root+'data',{recursive:true});
const db=new Database(process.env.DB_PATH||root+'data/returns.sqlite');
db.pragma('journal_mode = WAL');
db.exec('CREATE TABLE IF NOT EXISTS returns (session TEXT PRIMARY KEY, answers TEXT NOT NULL, step INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL)');
const app=express();const port=Number(process.env.PORT||3000);
app.disable('x-powered-by');
app.use((req,res,next)=>{
 if(!['127.0.0.1','localhost'].includes(req.hostname))return res.status(403).send('Local access only');
 res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'self' blob:; base-uri 'self'; form-action 'self'"});
 if(!['GET','HEAD'].includes(req.method)&&req.get('origin')!==`http://${req.get('host')}`)return res.status(403).json({error:'Invalid request origin'});
 next();
});
app.use(express.json({limit:'64kb'}));
app.use('/api',(req,res,next)=>{
 let token=req.headers.cookie?.split('; ').find(c=>c.startsWith('filetax='))?.slice(8);
 if(!token||!/^[a-f0-9]{64}$/.test(token)){token=randomBytes(32).toString('hex');res.cookie('filetax',token,{httpOnly:true,sameSite:'strict',maxAge:30*86400000,path:'/'});}
 req.token=token; next();
});
const get=req=>{const row=db.prepare('SELECT * FROM returns WHERE session=?').get(req.token);return row?{answers:JSON.parse(row.answers),step:row.step,updated:row.updated}:{answers:{},step:-1,updated:null};};
app.get('/api/return',(req,res)=>{const r=get(req);res.json({...r,draft:draft(r.answers)});});
app.put('/api/return',(req,res,next)=>{try{const answers=validate(req.body.answers);const step=req.body.step;if(!Number.isInteger(step)||step< -1||step>6)throw Error('Invalid interview step');const snapshot=draft(answers);const updated=new Date().toISOString();db.prepare('INSERT INTO returns VALUES (?,?,?,?) ON CONFLICT(session) DO UPDATE SET answers=excluded.answers,step=excluded.step,updated=excluded.updated').run(req.token,JSON.stringify(answers),step,updated);res.json({answers,step,updated,draft:snapshot});}catch(e){e.status=400;next(e);}});
app.delete('/api/return',(req,res)=>{db.prepare('DELETE FROM returns WHERE session=?').run(req.token);res.sendStatus(204);});
app.get('/api/export',(req,res)=>{const r=get(req);res.attachment('form1040-draft-2025.json').json({...r,draft:draft(r.answers)});});
// Only the 2025 IRS PDFs are bundled; later years are on-screen until the IRS publishes their forms.
const pdfYear=answers=>{if(answers.taxYear&&answers.taxYear!=='2025')throw Object.assign(Error(`The IRS has not released the ${answers.taxYear} Form 1040 yet. PDF download is available for 2025 only.`),{status:400});};
app.get('/api/pdf',async(req,res,next)=>{try{const r=get(req);pdfYear(r.answers);const bytes=await makePdf(r.answers,draft(r.answers));res.attachment('form1040-draft-2025.pdf').type('pdf').send(Buffer.from(bytes));}catch(e){next(e);}});
app.post('/api/forms',async(req,res,next)=>{try{
 const answers=validate(req.body.answers);pdfYear(answers);let snapshot;try{snapshot=draft(answers);}catch(e){e.status=400;throw e;}
 if(req.body.format==='json')return res.json(snapshot);
 const id=req.body.form||'packet';
 if(id!=='packet'&&!snapshot.forms.some(f=>f.id===id))throw Object.assign(Error('This form is not active.'),{status:400});
 const bytes=id==='packet'?await makePacket(answers,snapshot):await makeFormPdf(answers,snapshot,id);
 res.type('pdf').set('Content-Disposition',`inline; filename="estimated-${id}-2025.pdf"`).send(Buffer.from(bytes));
 }catch(e){if(!e.status&&!(e instanceof TypeError))e.status=400;next(e);}});
// Prints the Form 1040 template exactly as shown on screen (any supported tax year).
app.post('/api/print',async(req,res,next)=>{try{const bytes=await makePrintPdf(req.body.doc);res.type('pdf').set('Content-Disposition',`attachment; filename="form1040-${req.body.doc.year}.pdf"`).send(Buffer.from(bytes));}catch(e){next(e);}});
app.use(express.static(root+'public'));
app.use((err,req,res,next)=>{res.status(err.status||500).json({error:err.status===400?err.message:'Unable to process request. Check your answers or try again.'});});
const server=app.listen(port,'127.0.0.1',()=>console.log(`FileTax ready at http://localhost:${port}`));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
