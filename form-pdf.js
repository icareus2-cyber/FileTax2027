import {PDFDocument,rgb} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {makePdf} from './pdf.js';
export const scheduleMaps={
 c:{'1':'f1_10','2':'f1_11','3':'f1_12','4':'f1_13','5':'f1_14','6':'f1_15','7':'f1_16','28':'f1_41','29':'f1_42','30':'f1_45','31':'f1_46'},
 e:{'3':'f1_16','18':'f1_61','20':'f1_68','21':'f1_71','22':'f1_74','23a':'f1_77','23d':'f1_80','23e':'f1_81','24':'f1_82','25':'f1_83','26':'f1_84'},
 '1':{'3':'f1_07','5':'f1_09','10':'f1_38','20':'f2_12','26':'f2_30'}
};
export async function makeFormPdf(answers,snapshot,id){
 const model=snapshot.forms.find(f=>f.id===id);if(!model)throw Object.assign(Error('This form is not active.'),{status:400});
 if(id==='1040')return makePdf(answers,snapshot);
 const pdf=await PDFDocument.load(await readFile(new URL(`./assets/schedule-${id}-2025.pdf`,import.meta.url)));
 const fields=pdf.getForm().getFields();
 const fill=(suffix,value)=>{if(value===null||value===undefined||value==='')return;const f=fields.find(f=>f.getName().endsWith(`.${suffix}[0]`));if(!f)throw Error('Missing PDF mapping '+suffix);f.setText(String(value));};
 for(const [line,suffix]of Object.entries(scheduleMaps[id]))fill(suffix,model.lines[line]);
 fill(id==='1'?'f1_01':'f1_1',[answers.firstName,answers.lastName].filter(Boolean).join(' '));
 if(id==='e')fill('f1_3',answers.rentalAddress);
 for(const page of pdf.getPages())page.drawText('ESTIMATED DRAFT - NOT FOR FILING - Unallocated amounts and missing details require review',{x:32,y:8,size:8,color:rgb(.65,.1,.1)});
 if(snapshot.exampleFields?.length)for(const page of pdf.getPages())page.drawText('CONTAINS HYPOTHETICAL EXAMPLES - REPLACE WITH YOUR FIGURES',{x:32,y:775,size:9,color:rgb(.65,.1,.1)});
 return pdf.save();
}
export async function makePacket(answers,snapshot){
 const packet=await PDFDocument.create();
 for(const form of snapshot.forms){const pdf=await PDFDocument.load(await makeFormPdf(answers,snapshot,form.id));pdf.getForm().flatten();const pages=await packet.copyPages(pdf,pdf.getPageIndices());for(const page of pages)packet.addPage(page);}
 return packet.save();
}
