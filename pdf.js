import { PDFDocument, rgb } from 'pdf-lib';
import {readFile} from 'node:fs/promises';
export const lineFields = {'1a':'f1_47','1z':'f1_57','2a':'f1_58','2b':'f1_59','3a':'f1_60','3b':'f1_61','4a':'f1_62','4b':'f1_63','5a':'f1_65','5b':'f1_66','6a':'f1_68','6b':'f1_69','7a':'f1_70','8':'f1_72','9':'f1_73','10':'f1_74','11a':'f1_75','11b':'f2_01','12e':'f2_02','13a':'f2_03','13b':'f2_04','14':'f2_05','15':'f2_06','16':'f2_08','17':'f2_09','18':'f2_10','19':'f2_11','20':'f2_12','21':'f2_13','22':'f2_14','23':'f2_15','24':'f2_16','25a':'f2_17','25b':'f2_18','25c':'f2_19','25d':'f2_20','26':'f2_21','27a':'f2_23','28':'f2_24','29':'f2_25','30':'f2_26','31':'f2_27','32':'f2_28','33':'f2_29','34':'f2_30','37':'f2_35'};
export async function makePdf(answers,draft){
 const pdf=await PDFDocument.load(await readFile(new URL('./assets/form1040-2025.pdf',import.meta.url)));
 const form=pdf.getForm();
 const fill=(id,value)=>{if(value===null||value===undefined||value==='')return;const field=form.getFields().find(f=>f.getName().endsWith(`.${id}[0]`));field.setText(String(value));};
 for(const [line,id] of Object.entries(lineFields))fill(id,draft.lines[line]);
 for(const [key,id] of Object.entries({firstName:'f1_14',lastName:'f1_15',address:'f1_20',city:'f1_22',state:'f1_23',zip:'f1_24'}))fill(id,answers[key]);
 if(answers.status==='Married filing separately')fill('f1_28',answers.spouseName);
 // Full spouse name remains in the interview; do not guess how to split names.
 const checks={'Single':'Checkbox_ReadOrder[0].c1_8[0]','Married filing jointly':'Checkbox_ReadOrder[0].c1_8[1]','Married filing separately':'Checkbox_ReadOrder[0].c1_8[2]','Head of household':'c1_8[0]','Qualifying surviving spouse':'c1_8[1]'};
 if(checks[answers.status])form.getCheckBox('topmostSubform[0].Page1[0].'+checks[answers.status]).check();
 if(answers.digital)form.getCheckBox('topmostSubform[0].Page1[0].c1_10['+(answers.digital==='Yes'?0:1)+']').check();
 for(const p of pdf.getPages())p.drawText('ESTIMATED DRAFT - NOT FOR FILING - Review all amounts and missing details',{x:40,y:8,size:9,color:rgb(.65,.1,.1)});
 if(draft.exampleFields?.length)for(const p of pdf.getPages())p.drawText('CONTAINS HYPOTHETICAL EXAMPLES - REPLACE WITH YOUR FIGURES',{x:40,y:770,size:9,color:rgb(.65,.1,.1)});
 return pdf.save();
}
