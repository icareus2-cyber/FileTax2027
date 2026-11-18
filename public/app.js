import {removeExamples} from './examples.js';
import {LiveSession} from './live-session.js';
import {sections} from './questions.js';
import {assessment,pruneAssessment,quickHints,screeningNotes} from './screening.js';
import {assessmentProgress,buildReturn} from './template.js';
import {taxYears,yearOf,yearText} from './tax-years.js';
import {fieldHelp,formHelp} from './field-help.js';
import {keyPoints} from './key-points.js';
import {applyBenefit,currentValue,optionAmount,removeBenefit} from './apply.js';
import {formDefs} from './form-defs.js';
import {TaxReturn} from './return-model.js';
import {loadDraft,printPdf,saveDraft} from './storage.js';
let answers={},result,dirty=false,valid=true,autoTimer;
// The return (template figures plus the user's entries) is rebuilt on every refresh; template figures are never saved.
let filled=null;
const current=()=>filled?filled.merged:answers;
const live=new LiveSession();

const $=s=>document.querySelector(s);
const money=n=>n===null||n===undefined?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const spec=Object.fromEntries(sections.flatMap(s=>s.fields).map(([key,label,type,options,hint])=>[key,{label,type,options,hint}]));
function error(e){$('#error').hidden=false;$('#error').textContent=e.message;}

// Form 1040 layout: [line, description, answer key or null, calculated line, emphasize].
const identity=[[['firstName','Your first name and middle initial'],['lastName','Last name']],[['spouseName','If joint return, spouse’s first name, middle initial, and last name']],[['address','Home address (number and street)']],[['city','City, town, or post office'],['state','State'],['zip','ZIP code']]];
const layout=[
 ['Income',[
  ['1a','Total amount from Form(s) W-2, box 1','wages'],
  ['1b–h','Other earned income (lines 1b through 1h combined)','otherWages'],
  ['1z','Add lines 1a through 1h',null,'1z'],
  [['2a','Tax-exempt interest','exemptInterest'],['2b','Taxable interest','interest']],
  [['3a','Qualified dividends','qualifiedDividends'],['3b','Ordinary dividends','dividends']],
  [['4a','IRA distributions','iraGross'],['4b','Taxable amount','ira']],
  [['5a','Pensions and annuities','pensionGross'],['5b','Taxable amount','pension']],
  [['6a','Social security benefits','ssGross'],['6b','Taxable amount','ss']],
  ['7','Capital gain or (loss). Attach Schedule D if required','gains'],
  ['8','Additional income from Schedule 1, line 10','additionalIncome','8'],
  ['9','Add lines 1z, 2b, 3b, 4b, 5b, 6b, 7, and 8. This is your total income',null,'9',true],
  ['10','Adjustments to income from Schedule 1, line 26','adjustments','10'],
  ['11','Subtract line 10 from line 9. This is your adjusted gross income',null,'11a',true],
  ['12','Standard deduction or itemized deductions (from Schedule A)','deduction','12e'],
  ['13a','Qualified business income deduction from Form 8995 or 8995-A','qbi'],
  ['13b','Additional deductions from Schedule 1-A, line 38','extraDeduction'],
  ['14','Add lines 12 and 13',null,'14'],
  ['15','Subtract line 14 from line 11. This is your taxable income',null,'15',true]]],
 ['Tax and Credits',[
  ['16','Tax (see instructions)','tax'],
  ['17','Amount from Schedule 2, line 3','schedule2Tax'],
  ['18','Add lines 16 and 17',null,'18'],
  ['19','Child tax credit or credit for other dependents from Schedule 8812','childCredit'],
  ['20','Amount from Schedule 3, line 8','otherCredits'],
  ['21','Add lines 19 and 20',null,'21'],
  ['22','Subtract line 21 from line 18. If zero or less, enter -0-',null,'22'],
  ['23','Other taxes, including self-employment tax, from Schedule 2, line 21','otherTax'],
  ['24','Add lines 22 and 23. This is your total tax',null,'24',true]]],
 ['Payments',[
  ['25a','Federal income tax withheld from Form(s) W-2','withheld'],
  ['25b','Federal income tax withheld from Form(s) 1099','withheld1099'],
  ['25c','Federal income tax withheld from other forms','withheldOther'],
  ['25d','Add lines 25a through 25c',null,'25d'],
  ['26','Estimated tax payments and amount applied from {prev} return','estimated'],
  ['27a','Earned income credit (EIC)','eic'],
  ['28','Additional child tax credit from Schedule 8812','actc'],
  ['29','American opportunity credit from Form 8863, line 8','education'],
  ['30','Refundable adoption credit from Form 8839, line 13','adoption'],
  ['31','Amount from Schedule 3, line 15','otherPayments'],
  ['32','Add lines 27a and 28 through 31. These are your total other payments and refundable credits',null,'32'],
  ['33','Add lines 25d, 26, and 32. These are your total payments',null,'33',true]]],
 ['Refund',[['34','If line 33 is more than line 24, this is the amount you overpaid',null,'34',true]]],
 ['Amount You Owe',[['37','Subtract line 33 from line 24. This is the amount you owe',null,'37',true]]]
];

function input(key){
 const {type,label,hint}=spec[key];const f=el(type==='textarea'?'textarea':'input');f.id=key;f.dataset.key=key;
 if(type==='money'||type==='signed'){f.type='number';f.step='.01';f.max='10000000000';f.min=type==='money'?'0':'-10000000000';f.inputMode='decimal';}
 else if(type!=='textarea'){f.type='text';f.maxLength=type==='state'?2:type==='zip'?10:200;if(type==='zip')f.pattern='[0-9]{5}(-[0-9]{4})?';if(type==='state')f.pattern='[A-Za-z]{2}';}
 f.value=answers[key]??'';f.title=hint||label;f.oninput=()=>{unmark(f);markDirty();};f.onchange=()=>{if(f.value==='')refresh();};return f;
}
function choices(key,options,labels=options){
 const box=el('div',undefined,'choices');box.setAttribute('role','radiogroup');
 options.forEach((value,i)=>{const lab=el('label',undefined,'choice');const r=el('input');r.type='radio';r.name=key;r.value=value;r.id=key+'-'+i;r.dataset.key=key;r.checked=answers[key]===value;r.onchange=()=>{for(const o of box.querySelectorAll('input'))unmark(o);box.classList.remove('template');markDirty();};lab.append(r,document.createTextNode(labels[i]));box.append(lab);});
 return box;
}
function lineCell([line,label,key,calc,strong]){
 const row=el('div',undefined,'line'+(strong?' strong':''));row.dataset.row=line;row.append(el('span',line,'ln'));
 const desc=el('div',undefined,'desc'),text=el(key?'label':'span',yearText(label,yearOf(answers)));if(key)text.htmlFor=key;desc.append(text,fxButton('1040:'+line));row.append(desc,el('span',line,'box-ln'));
 if(key)row.append(input(key));else{const out=el('output','—','amount');out.dataset.line=calc;row.append(out);}
 const fx=el('div',undefined,'formula');fx.hidden=true;row.append(fx);
 return row;
}
// Formulas for calculated Form 1040 lines. [x] refers to a Form 1040 line on this page;
// schedule formulas come from template.js and may point to other forms as [form:line].
const f1040={'1z':'[1a] + [1b–h]','9':'[1z] + [2b] + [3b] + [4b] + [5b] + [6b] + [7] + [8]','11':'[9] − [10]','14':'[12] + [13a] + [13b]','15':'[11] − [14], not less than zero','18':'[16] + [17]','21':'[19] + [20]','22':'[18] − [21], not less than zero','24':'[22] + [23]','25d':'[25a] + [25b] + [25c]','32':'[27a] + [28] + [29] + [30] + [31]','33':'[25d] + [26] + [32]','34':'[33] − [24], if line 33 is larger','37':'[24] − [33], if line 24 is larger'};
const resultLine={'7':'7a','11':'11a','12':'12e'};
const lineOfKey=Object.fromEntries(layout.flatMap(([,rows])=>rows.flatMap(row=>Array.isArray(row[0])?row:[row])).filter(c=>c[2]).map(c=>[c[2],c[0]]));
let showAll=false;const openFx=new Set();
function fxButton(ref){
 const b=el('button','ƒx','fx');b.type='button';b.dataset.fx=ref;b.hidden=true;b.title='Show how this line is calculated';b.setAttribute('aria-expanded','false');
 b.onclick=()=>{openFx.has(ref)?openFx.delete(ref):openFx.add(ref);updateFormulas();};return b;
}
function value1040(line){return line==='1b–h'?current().otherWages??null:result.lines[resultLine[line]||line]??null;}
function how1040(line){
 if(f1040[line])return f1040[line];
 const key=Object.keys(lineOfKey).find(k=>lineOfKey[k]===line);if(!key)return null;
 const m=current();
 if(filled?.locks[key])return filled.explain[key];
 if(key==='tax'&&answers.tax===undefined&&filled?.src.tax==='auto')return filled.explain.tax;
 if(key==='deduction'&&m.deductionMethod!=='Enter verified deduction'&&result.lines['12e']!==null)return `${yearOf(answers)} standard deduction for ${m.status}`;
 if(result.linked&&['additionalIncome','adjustments'].includes(key))return 'Calculated from saved Schedule 1 estimates';
 return null;
}
const formLine=(id,line)=>filled?.forms.find(f=>f.id===id)?.lines.find(l=>l.line===line);
const show=(value,fmt)=>fmt==='pct'&&value!==null&&value!==undefined?Math.round(value*1000)/10+'%':money(value);
// Resolves [line] or [form:line] to a label, current amount, and the row it points to.
function resolve(token,ctx){
 const [form,line]=token.includes(':')?[token.slice(0,token.indexOf(':')),token.slice(token.indexOf(':')+1)]:[ctx,token];
 if(form==='1040')return {label:(ctx==='1040'?'line ':'Form 1040 line ')+line,text:money(value1040(line)),row:()=>$(`#form1040 [data-row="${line}"]`)};
 const f=filled?.forms.find(x=>x.id===form),l=formLine(form,line);
 return {label:(form===ctx?'line ':`${f?.title??form}${form.endsWith('Spouse')?' (spouse)':''} line `)+line,text:show(l?.value,l?.fmt),row:()=>$(`#template-forms [data-form="${form}"] [data-row="${line}"]`)};
}
function formula(how,ctx,line,total){
 const parts=[el('span',`Line ${line} = `,'fx-lead')];let last=0;
 for(const match of how.matchAll(/\[([^\]]+)\]/g)){
  parts.push(document.createTextNode(how.slice(last,match.index)));last=match.index+match[0].length;
  const ref=resolve(match[1],ctx),b=el('button',`${ref.label} (${ref.text})`,'ref');b.type='button';
  const mark=on=>ref.row()?.classList.toggle('hl',on);
  b.onmouseenter=b.onfocus=()=>mark(true);b.onmouseleave=b.onblur=()=>mark(false);
  b.onclick=()=>{const row=ref.row();if(!row)return;row.scrollIntoView?.({block:'center',behavior:'smooth'});row.classList.add('flash');setTimeout(()=>row.classList.remove('flash'),1600);};
  parts.push(b);
 }
 parts.push(document.createTextNode(how.slice(last)),el('strong',` = ${total}`,'fx-total'));
 return parts;
}
// Shows the ƒx button on every line that is currently calculated, and opens the formulas asked for.
function updateFormulas(){
 for(const b of document.querySelectorAll('.fx')){
  const ref=b.dataset.fx,ctx=ref.slice(0,ref.indexOf(':')),line=ref.slice(ref.indexOf(':')+1);
  const how=valid?(ctx==='1040'?how1040(line):formLine(ctx,line)?.how):null;
  const row=b.closest('.line'),box=row.querySelector('.formula'),open=!!how&&(showAll||openFx.has(ref));
  b.hidden=!how;b.classList.toggle('on',open);b.setAttribute('aria-expanded',String(open));box.hidden=!open;row.classList.toggle('calculated',!!how);
  if(open)box.replaceChildren(...formula(how,ctx,line,ctx==='1040'?money(value1040(line)):show(formLine(ctx,line).value,formLine(ctx,line).fmt)));
 }
}
function legend(){
 const bar=el('div',undefined,'legend');
 for(const [cls,text] of [['user','Your figure'],['template','Template figure to replace'],['auto','Calculated; type to override'],['form','Carried from another form'],['calc','Calculated line']])bar.append(el('span',text,'swatch '+cls));
 const label=el('label',undefined,'show-all'),cb=el('input');cb.type='checkbox';cb.id='show-all-calcs';cb.onchange=()=>{showAll=cb.checked;updateFormulas();};
 label.append(cb,document.createTextNode('Show all calculations'));bar.append(label,el('span','Select ƒx on any calculated line to see its formula with your current amounts.','legend-tip'));
 return bar;
}
function renderForm(){
 const form=$('#form1040');form.replaceChildren();
 const head=el('div',undefined,'form-head');head.append(el('div','Form 1040','form-id'),el('div','U.S. Individual Income Tax Return','form-title'),el('div',String(yearOf(answers)),'form-year'));form.append(head);
 const Y=yearOf(answers);$('.badge').textContent=Y+' FEDERAL RETURN';
 const banner=el('div',undefined,'template-banner');banner.id='template-banner';form.append(banner,legend());
 const id=el('div',undefined,'identity');
 for(const row of identity){const r=el('div',undefined,'id-row');for(const [key,label] of row){const cell=el('div',undefined,'id-cell');const lab=el('label',label);lab.htmlFor=key;cell.append(lab,input(key));r.append(cell);}id.append(r);}
 form.append(id);
 const status=el('fieldset',undefined,'check-row');status.append(el('legend','Filing Status'),choices('status',spec.status.options));form.append(status);
 for(const [key,title,text] of [['digital','Digital Assets',`At any time during ${Y}, did you receive, sell, exchange, or otherwise dispose of a digital asset?`],['special','Standard Deduction',spec.special.hint],['dependents','Dependents','Do you have dependents to claim?']]){
  const f=el('fieldset',undefined,'check-row');f.append(el('legend',title),el('span',text,'question-text'),choices(key,['Yes','No']));form.append(f);
 }
 for(const [name,rows] of layout){
  const sec=el('section',undefined,'form-section');sec.append(el('h2',name,'sec-label'));const body=el('div',undefined,'sec-body');
  for(const row of rows){
   if(Array.isArray(row[0])){const pair=el('div',undefined,'pair');for(const half of row)pair.append(lineCell(half));body.append(pair);}
   else body.append(lineCell(row));
   if(row[0]==='12'){const m=el('div',undefined,'line method');m.append(el('span','','ln'),el('span','Deduction method','desc'),choices('deductionMethod',spec.deductionMethod.options,['Basic standard deduction','Enter verified amount']));body.append(m);}
  }
  sec.append(body);form.append(sec);
 }
 const notes=el('div',undefined,'id-cell notes');const lab=el('label','Dependent details or other information to review');lab.htmlFor='notes';notes.append(lab,input('notes'),el('small',spec.notes.hint,'hint'));form.append(notes);
 form.append(el('p','Draft estimate only. Tax and credit amounts must come from verified IRS worksheets. This app does not file a return. Do not enter SSNs or bank account numbers.','disclaimer'));
}

// The right-hand panel has two tabs: the Quick Assessment and Key Points.
let panel='assess';
function panelTabs(){
 const bar=el('div',undefined,'panel-tabs');bar.setAttribute('role','tablist');
 for(const [id,text] of [['assess','Quick Assessment'],['keys','Key Points']]){
  const b=el('button',text,'panel-tab');b.type='button';b.id='tab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(panel===id));
  b.onclick=()=>{if(panel===id)return;panel=id;renderAssessment();};bar.append(b);
 }
 return bar;
}
// Where an applied value lands, in words: "Form 1040, line 1a" or "Schedule 1, line 20".
function targetText(target){
 if(!target)return 'recorded only; no line changes';
 const [kind,a,b]=target.split(':');
 if(kind==='1040')return a==='status'?'Form 1040 filing status':`Form 1040, line ${lineOfKey[a]||a}`;
 const def=formDefs[a.replace(/Spouse$/,'')];return `${def?.title??a}${a.endsWith('Spouse')?' (spouse)':''}, line ${b}`;
}
const inputLabels={money:'Amount ($)',count:'Number',sqft:'Square feet used regularly and only for business',miles:'Business miles driven'};
function linesFor(a){try{const p=assessmentProgress(a);return new TaxReturn(p.remaining<p.total?buildReturn(a).merged:a).snapshot().lines;}catch{return null;}}
function outcome(l){return l['34']>0?`refund ${money(l['34'])}`:`you owe ${money(l['37']??0)}`;}
// A small window to choose how to apply a strategy and enter its value.
function openApply(strategy){
 closeApply();
 const applied=answers._applied||[],prior=applied.find(r=>strategy.apply.some(o=>o.id===r.option));
 let option=strategy.apply.find(o=>o.id===prior?.option)||strategy.apply[0];
 const back=el('div',undefined,'modal-back');back.id='apply-dialog';
 const box=el('div',undefined,'modal');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','apply-title');
 const title=el('h2','Apply: '+strategy.title);title.id='apply-title';
 const x=el('button','×','modal-x');x.type='button';x.setAttribute('aria-label','Close');x.onclick=closeApply;
 const choices=el('fieldset',undefined,'apply-options');choices.append(el('legend','How do you want to apply it?'));
 const field=el('div',undefined,'apply-field'),preview=el('p','','apply-preview');
 const input=el('input');input.id='apply-value';input.type='number';input.min='0';input.inputMode='decimal';
 const inputLabel=el('label','');inputLabel.htmlFor='apply-value';
 const hint=el('p','','apply-hint');
 const valueOf=()=>option.input==='none'?0:input.value;
 const update=()=>{
  const now=option.target?currentValue(answers,filled,option.target):null;
  field.hidden=option.input==='none';inputLabel.textContent=inputLabels[option.input]||'Amount';input.step=option.input==='count'?'1':'any';input.max=option.input==='sqft'?'300':option.max&&option.input==='money'?String(option.max):'';
  const amount=optionAmount(option,valueOf());
  hint.textContent=[
   option.mode==='status'?`Changes the filing status to ${option.status}.`:option.mode==='note'?'Recorded in your Key Points only; it does not change the return.':`${option.mode==='add'?(option.sign<0?'Subtracts from':'Adds to'):'Goes to'} ${targetText(option.target)}${now!==undefined&&now!==null&&option.mode!=='note'?` (now ${typeof now==='number'?(option.input==='count'?now:money(now)):now})`:''}.`,
   option.factor&&option.input!=='count'?`That is ${money(amount)}${option.input==='sqft'?' ($5 per square foot, up to 300)':''}.`:'',
   option.max&&option.input==='money'?`Limit: ${money(option.max)}.`:''
  ].filter(Boolean).join(' ');
  const before=result.lines,after=option.mode==='note'?null:linesFor(applyBenefit(answers,filled,strategy,option,valueOf()));
  preview.textContent=!after?'':after['24']===null?'Effect: enter the remaining figures to see the effect.':`Effect: total tax ${money(before['24'])} → ${money(after['24'])} (${after['24']-before['24']<=0?'saves '+money(before['24']-after['24']):'adds '+money(after['24']-before['24'])}); ${outcome(before)} → ${outcome(after)}.`;
  applyBtn.disabled=option.input!=='none'&&(input.value===''||!input.checkValidity());
 };
 strategy.apply.forEach((o,i)=>{
  const lab=el('label',undefined,'apply-option'),r=el('input');r.type='radio';r.name='apply-option';r.id='apply-opt-'+i;r.value=o.id;r.checked=o===option;
  r.onchange=()=>{option=o;const rec=applied.find(a=>a.option===o.id);input.value=rec?rec.amount/(o.factor||1):'';update();};
  lab.append(r,document.createTextNode(o.label));
  if(applied.some(a=>a.option===o.id))lab.append(el('span','applied','apply-tag'));
  choices.append(lab);
 });
 if(prior&&option.input!=='none')input.value=String(Math.round(prior.amount/(option.factor||1)*100)/100);
 input.oninput=update;
 field.append(inputLabel,input);
 const actions=el('div',undefined,'actions'),cancel=button('Cancel',closeApply),applyBtn=button(prior?'Update':'Apply',()=>{
  answers=applyBenefit(answers,filled,strategy,option,valueOf());closeApply();refresh();markDirty();
  $('#save-status').textContent=`Applied: ${option.label}`;
 });
 applyBtn.id='apply-confirm';applyBtn.classList.add('primary');actions.append(cancel,applyBtn);
 box.append(x,title,el('p',strategy.why,'kp-why'),choices,field,hint,preview,actions);back.append(box);document.body.append(back);
 back.addEventListener('mousedown',e=>{if(e.target===back)closeApply();});
 update();(option.input==='none'?applyBtn:input).focus();
}
function closeApply(){$('#apply-dialog')?.remove();}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeApply();});
function removeApplied(i){answers=removeBenefit(answers,i);refresh();markDirty();}
function appliedList(){
 const list=answers._applied||[];if(!list.length)return null;
 const box=el('section',undefined,'kp-applied');box.append(el('h3',`Applied benefits (${list.length})`));
 list.forEach((r,i)=>{
  const row=el('div',undefined,'kp-applied-row'),text=el('div');
  text.append(el('strong',r.label),el('span',`${r.mode==='status'?r.status:r.option==='children'||r.option==='other-dependents'?r.amount:money(r.amount)} → ${targetText(r.target)}`,'kp-applied-to'));
  const rm=button('Remove',()=>removeApplied(i));rm.classList.add('kp-remove');rm.setAttribute('aria-label','Remove '+r.label);
  row.append(text,rm);box.append(row);
 });
 return box;
}
function renderKeyPoints(){
 const host=$('#key-points');if(!host)return;host.replaceChildren();
 host.append(el('div','KEY POINTS','eyebrow'),el('h2','Your return and how to lower it'),el('p','A summary of what you have told us, the resulting return, and tax-saving strategies that fit your situation. It updates as you edit.','muted'));
 if(!valid){host.append(el('p','Fix the highlighted input on the form to update Key Points.','kp-caution'));return;}
 const kp=keyPoints(answers,filled,result.lines);
 for(const c of kp.cautions)host.append(el('p',c,'kp-caution'));
 host.append(el('h3','Your return at a glance'));
 const facts=el('dl',undefined,'kp-facts');for(const [k,v] of kp.facts)facts.append(el('dt',k),el('dd',v));host.append(facts);
 if(kp.income.length){host.append(el('h3','Income you reported'));const ul=el('ul',undefined,'kp-list');for(const i of kp.income)ul.append(el('li',i));host.append(ul);}
 if(kp.forms.length){host.append(el('h3','Forms in your return'));const chips=el('div',undefined,'kp-forms');for(const f of kp.forms)chips.append(el('span',f,'kp-form'));host.append(chips);}
 const applied=appliedList();if(applied)host.append(applied);
 host.append(el('h3',`Tax-saving strategies (${kp.strategies.length})`));
 if(!kp.strategies.length)host.append(el('p','Answer the Quick Assessment to see strategies for your situation.','muted'));
 for(const s of kp.strategies){
  const card=el('article',undefined,'kp-card');card.dataset.strategy=s.id;const head=el('div',undefined,'kp-card-head');head.append(el('h4',s.title));
  if(s.apply.length){const b=button('Apply…',()=>openApply(s));b.classList.add('kp-apply');b.setAttribute('aria-label','Apply: '+s.title);head.append(b);}
  card.append(head);
  const done=(answers._applied||[]).filter(r=>s.apply.some(o=>o.id===r.option));
  if(done.length)card.append(el('p','✓ Applied: '+done.map(r=>r.mode==='status'?r.status:r.label.split(' (')[0]+' '+(r.option==='children'||r.option==='other-dependents'?r.amount:money(r.amount))).join('; '),'kp-done'));
  card.append(el('p',s.why,'kp-why'),el('p',s.action));
  if(s.saving)card.append(el('p',s.saving,'kp-saving'));
  const link=el('a','IRS guidance ↗');link.href=s.url;link.target='_blank';link.rel='noreferrer';card.append(link);host.append(card);
 }
 host.append(el('p',`Savings are rough federal income tax estimates at your ${Math.round(kp.rate*100)}% bracket; they leave out state tax and limits that depend on details not collected here. This is general information, not tax advice.`,'disclaimer'));
}
const chipLabels={'Not sure / skip':'Skip','Yes, jointly with my spouse':'Jointly'},jointChoice={No:'Separately'};
const openHints=new Set();
// The panel is rebuilt after every answer so questions appear, split per spouse, or disappear as they apply.
function renderAssessment(){
 const root=$('#assessment'),focused=document.activeElement?.id;root.replaceChildren(panelTabs());
 if(panel==='keys'){const host=el('section');host.id='key-points';root.append(host);renderKeyPoints();if(focused)document.getElementById(focused)?.focus();return;}
 const head=el('div',undefined,'assess-head');head.append(el('div','QUICK ASSESSMENT','eyebrow'),el('h2','Your situation at a glance'),el('p','Check one answer per question, or skip it. Follow-up questions appear based on your answers. Your answers decide your filing status and which forms your return needs. The forms are set up with template figures as you answer; replace them with your actual tax data. Highlighted questions still need an answer.','muted'));
 const count=el('div','','assess-count');count.id='assess-count';head.append(count);root.append(head);
 for(const group of assessment(answers)){
  root.append(el('h3',group.title));
  for(const {key,label,type,options,hint,rows} of group.items){
   const q=el('div',undefined,'assess-q'+(rows.some(r=>r.who)?' per-person':'')+(rows.some(r=>!answers[r.key])?' unanswered':''));q.dataset.question=key;const top=el('div',undefined,'assess-top'),text=el('span',undefined,'assess-label');
   if(key==='reviewUSHome'){const [before,after]=label.split(String(yearOf(answers)));text.append(before,yearPicker(),after);}else text.textContent=label;
   top.append(text);q.append(top);
   const tipText=quickHints[key]?yearText(quickHints[key],yearOf(answers)):hint;
   if(tipText){const tip=el('p',tipText,'assess-hint');tip.id=key+'-help';tip.hidden=!openHints.has(key);const help=el('button','?','help');help.type='button';help.id=key+'-helpbtn';help.setAttribute('aria-label','Explain: '+label);help.setAttribute('aria-expanded',String(!tip.hidden));help.setAttribute('aria-controls',tip.id);help.onclick=()=>{tip.hidden=!tip.hidden;tip.hidden?openHints.delete(key):openHints.add(key);help.setAttribute('aria-expanded',String(!tip.hidden));};top.append(help);q.append(tip);}
   for(const {key:rowKey,who} of rows){
    const row=el('div',undefined,'assess-row');if(who)row.append(el('span',who,'who'));
    const name=who?who+': '+label:label;
    if(type==='select'&&options.length>3){const s=el('select');s.id=rowKey;s.setAttribute('aria-label',name);for(const v of ['',...options]){const o=el('option',v||'Not answered');o.value=v;s.append(o);}s.value=answers[rowKey]??'';s.onchange=()=>answer(rowKey,s.value);row.append(s);}
    else{const box=el('div',undefined,'chips');box.setAttribute('role','group');box.setAttribute('aria-label',name);options.forEach((value,i)=>{const c=el('label',undefined,'chip');const cb=el('input');cb.type='checkbox';cb.id=rowKey+'-'+i;cb.checked=answers[rowKey]===value;cb.onchange=()=>answer(rowKey,cb.checked?value:'');c.append(cb,document.createTextNode((key==='reviewJoint'&&jointChoice[value])||chipLabels[value]||value));box.append(c);});row.append(box);}
    q.append(row);
   }
   root.append(q);
  }
 }
 const review=el('div',undefined,'review');review.append(el('h3','Items to review'));const ul=el('ul');ul.id='review-notes';review.append(ul);root.append(review);
 updateAssessment();
 if(focused)document.getElementById(focused)?.focus();
}
function yearPicker(){
 const s=el('select',undefined,'year-picker');s.id='taxYear';s.setAttribute('aria-label','Tax year');
 for(const y of taxYears){const o=el('option',y);o.value=y;s.append(o);}s.value=String(yearOf(answers));
 s.onchange=()=>{answers.taxYear=s.value;formsShown='';renderForm();renderAssessment();markDirty();};return s;
}
function answer(key,value){
 if(value)answers[key]=value;else delete answers[key];
 answers=pruneAssessment(answers);renderAssessment();markDirty();
}
function updateAssessment(){
 if(panel==='keys'){renderKeyPoints();return;}
 const rows=assessment(answers).flatMap(g=>g.items.flatMap(q=>q.rows));const answered=rows.filter(r=>answers[r.key]&&answers[r.key]!=='Not sure / skip').length;
 $('#assess-count').textContent=answered+' of '+rows.length+' answered';
 const ul=$('#review-notes');ul.replaceChildren();for(const note of [...(filled?['Your filing status and forms come from these answers. Replace each shaded template figure with your actual tax data.',...filled.notes]:[]),...screeningNotes(answers)])ul.append(el('li',note));
}

function collect(){
 for(const f of document.querySelectorAll('#form1040 [data-key]')){
  const key=f.dataset.key;if(f.readOnly||f.dataset.template)continue;
  if(f.type==='radio'){if(f.checked)answers[key]=f.value;else if(!document.querySelector(`#form1040 [name="${key}"]:checked`))delete answers[key];continue;}
  if(f.value==='')delete answers[key];else answers[key]=f.type==='number'?Number(f.value):f.value;
 }
}
function refresh(){
 try{
  const bad=[...document.querySelectorAll('#form1040 [data-key],#template-forms [data-line]')].find(f=>!f.checkValidity());
  if(bad)throw Error((document.querySelector('label[for="'+bad.id+'"]')?.textContent||'Answer')+': '+bad.validationMessage);
  const progress=assessmentProgress(answers);filled=progress.remaining<progress.total?buildReturn(answers):null;
  result=live.evaluate(current());valid=true;$('#error').hidden=true;
 }catch(e){valid=false;live.revision++;error(e);$('#save-status').textContent='Fix input to update the form';for(const o of document.querySelectorAll('output[data-line]'))o.textContent='—';updateFormulas();updateAssessment();return false;}
 for(const o of document.querySelectorAll('#form1040 output[data-line]'))o.textContent=money(result.lines[o.dataset.line]);
 paint();renderTemplateForms();updateFormulas();updateAssessment();return true;
}
function unmark(f){delete f.dataset.template;f.classList.remove('template','auto');}
// Form 1040 lines that a schedule (or the standard deduction) fills, and the line each shows.
const lockedLine={additionalIncome:'8',adjustments:'10',deduction:'12e',interest:'2b',dividends:'3b',gains:'7a',qbi:'13a',childCredit:'19',otherCredits:'20',otherTax:'23',education:'29'};
// Shows each Form 1040 box as the user's figure, a shaded template figure, a calculated
// figure the user may override, or a figure carried from a schedule.
function paint(){
 const m=current(),src=filled?.src||{};
 const locks=filled?{...filled.locks}:result.linked?{additionalIncome:'saved Schedule 1 estimates',adjustments:'saved Schedule 1 estimates'}:{};
 if(m.deductionMethod!=='Enter verified deduction')locks.deduction='the basic standard deduction for your filing status';
 for(const f of document.querySelectorAll('#form1040 [data-key]')){
  const key=f.dataset.key,shaded=filled&&answers[key]===undefined&&m[key]!==undefined;
  if(f.type==='radio'){
   const box=f.closest('.choices');f.checked=(shaded?m[key]:answers[key])===f.value;
   if(shaded)f.dataset.template='1';else delete f.dataset.template;box.classList.toggle('template',!!shaded);
   continue;
  }
  const lock=locks[key],state=lock?'form':shaded&&src[key]==='auto'?'auto':shaded&&src[key]==='template'?'template':'user';
  f.readOnly=!!lock;f.classList.toggle('template',state==='template');f.classList.toggle('auto',state==='auto');
  if(state==='template'||state==='auto')f.dataset.template='1';else delete f.dataset.template;
  f.title=lock?'From '+lock+'. Change it there.':state==='template'?'Template figure. Type over it with your actual amount.':state==='auto'?'Calculated from your return. Type your own figure to override it.':spec[key].hint||spec[key].label;
  if(f===document.activeElement&&!lock)continue;
  f.value=lock?(result.lines[lockedLine[key]]??''):state==='user'?(answers[key]??''):(m[key]??'');
 }
 const banner=$('#template-banner'),progress=assessmentProgress(answers);banner.replaceChildren();banner.className='template-banner';
 if(!filled){banner.append(el('span','Answer the Quick Assessment on the right to set up your filing status and forms with template figures.'));return;}
 const pending=progress.remaining?` ${progress.remaining} Quick Assessment question${progress.remaining===1?' is':'s are'} still unanswered (highlighted) and treated as No; answering may add forms.`:'';
 if(!filled.remaining){banner.classList.add('done');banner.append(el('strong','YOUR DATA'),el('span','Every template figure has been replaced with your own amounts.'+pending));return;}
 banner.classList.add('on');
 banner.append(el('strong','TEMPLATE'),el('span',`${filled.remaining} shaded template figure${filled.remaining===1?'':'s'} left to replace with your actual tax data, here and on the forms below. Blue boxes are calculated from other lines.${pending}`),button('Confirm remaining $0 figures',confirmZeros));
}
function button(text,fn){const b=el('button',text);b.type='button';b.onclick=fn;return b;}
// Accepts every shaded template figure of zero as the user's own zero.
function confirmZeros(){
 for(const [key,s] of Object.entries(filled.src))if(s==='template'&&filled.merged[key]===0)answers[key]=0;
 const typed=answers._forms={...answers._forms};
 for(const f of filled.forms)for(const l of f.lines)if(l.source==='template'&&l.value===0)typed[f.id]={...typed[f.id],[l.line]:0};
 markDirty();
}
function setFormValue(id,line,value){
 const typed={...answers._forms},lines={...typed[id]};
 if(value==='')delete lines[line];else lines[line]=value;
 if(Object.keys(lines).length)typed[id]=lines;else delete typed[id];
 answers._forms=typed;
}
let formsShown='';
// Schedules are rebuilt only when the set of forms changes, so typing never loses focus.
function renderTemplateForms(){
 const host=$('#template-forms'),ids=filled?filled.forms.map(f=>f.id).join():'';
 if(ids!==formsShown){
  formsShown=ids;host.replaceChildren();
  if(filled){
   host.append(el('h2','Schedules and forms for your return','forms-heading'),el('p','Your Quick Assessment answers call for these forms. Replace each shaded template figure with your actual amount; totals carry to the other forms and to Form 1040.','muted forms-lead'));
   for(const f of filled.forms){
    const paper=el('section',undefined,'tform');paper.dataset.form=f.id;
    const head=el('div',undefined,'form-head');head.append(el('div',f.title,'form-id'),el('div',f.subtitle,'form-title'),el('div','','stamp'));paper.append(head);
    for(const l of f.lines){
     const row=el('div',undefined,'line');row.dataset.row=l.line;const id=`f-${f.id}-${l.line}`;const desc=el('div',undefined,'desc'),text=el(l.kind?'label':'span',l.label);if(l.kind)text.htmlFor=id;desc.append(text);if(!l.kind)desc.append(fxButton(f.id+':'+l.line));row.append(el('span',l.line,'ln'),desc,el('span',l.line,'box-ln'));
     let box;
     if(l.kind==='yesno'){box=el('select');for(const v of ['Yes','No']){const o=el('option',v);o.value=v;box.append(o);}box.onchange=()=>{unmark(box);setFormValue(f.id,l.line,box.value);markDirty();};}
     else if(l.kind){box=el('input');box.type='number';box.inputMode='decimal';box.min=l.kind==='signed'?'-10000000000':'0';box.max=l.kind==='count'?'50':'10000000000';box.step=l.kind==='count'?'1':'.01';
      box.oninput=()=>{unmark(box);if(box.value===''||box.checkValidity())setFormValue(f.id,l.line,box.value===''?'':Number(box.value));markDirty();};box.onchange=()=>{if(box.value==='')refresh();};}
     else box=el('output','','amount');
     box.id=id;box.dataset.form=f.id;box.dataset.line=l.line;const fx=el('div',undefined,'formula');fx.hidden=true;row.append(box,fx);paper.append(row);
    }
    host.append(paper);
   }
  }
 }
 if(!filled)return;
 for(const f of filled.forms){
  const paper=host.querySelector(`[data-form="${f.id}"]`);let left=0;
  for(const l of f.lines){
   const box=paper.querySelector(`[data-line="${l.line}"]`);
   if(!l.kind){box.textContent=l.fmt==='pct'?Math.round(l.value*1000)/10+'%':money(l.value);continue;}
   const shaded=l.source==='template';if(shaded)left++;
   box.classList.toggle('template',shaded);if(shaded)box.dataset.template='1';else delete box.dataset.template;
   box.title=shaded?'Template figure. Replace it with your actual amount.':'Your figure';
   if(box!==document.activeElement)box.value=l.value;
  }
  // Forms with nothing to type (such as Schedule 2) only total other forms.
  const typed=f.lines.some(l=>l.kind),stamp=paper.querySelector('.stamp');stamp.textContent=!typed?'CALCULATED':left?`TEMPLATE · ${left} left`:'YOUR DATA';stamp.classList.toggle('done',typed&&!left);stamp.classList.toggle('calc',!typed);
 }
}
async function persist(){
 const saved=await live.persist({...answers},0,saveDraft);
 if(saved.current){dirty=false;$('#save-status').textContent='All changes saved';}
}
function markDirty(){
 dirty=true;clearTimeout(autoTimer);collect();if(!refresh())return;
 $('#save-status').textContent='Saving…';
 autoTimer=setTimeout(()=>persist().catch(e=>{error(e);$('#save-status').textContent='Save failed - edits remain here';}),500);
}
// Captures the left-hand form exactly as displayed: every label, the amount in each box, and
// whether that box is the user's figure, a template figure, or calculated.
const boxState=b=>!b?'text':b.tagName==='OUTPUT'?'calc':b.classList.contains('template')?'template':b.classList.contains('auto')?'auto':b.readOnly?'form':'user';
const boxValue=b=>{if(!b)return '';if(b.tagName==='OUTPUT')return b.textContent;if(b.tagName==='SELECT')return b.value;return b.type==='number'&&b.value!==''?money(Number(b.value)):b.value;};
function snapshotRows(root){
 const out=[];
 for(const node of root.querySelectorAll('.form-section>.sec-label,.line')){
  if(node.classList.contains('sec-label')){out.push({heading:true,label:node.textContent});continue;}
  if(node.classList.contains('method')){const picked=node.querySelector('input:checked');out.push({line:'',label:'Deduction method',value:picked?picked.parentElement.textContent:'',state:picked?.dataset.template?'template':'text'});continue;}
  const box=node.querySelector('input[data-key],input[data-line],select[data-line],output');
  out.push({line:node.querySelector('.ln')?.textContent||'',label:node.querySelector('.desc')?.textContent.replace('ƒx','').trim()||'',value:boxValue(box),state:boxState(box),strong:node.classList.contains('strong')});
 }
 return out;
}
function pageSnapshot(){
 const form=$('#form1040');
 return {
  year:String(yearOf(answers)),
  notice:filled?.remaining?`${filled.remaining} amounts are template figures from the Quick Assessment (shaded amber), not actual data.`:'',
  identity:[...form.querySelectorAll('.id-cell:not(.notes)')].map(c=>[c.querySelector('label').textContent,c.querySelector('input').value]).concat([['Notes',$('#notes').value]]),
  checks:[...form.querySelectorAll('.check-row')].map(set=>{const picked=set.querySelector('input:checked');return {title:set.querySelector('legend').textContent,question:set.querySelector('.question-text')?.textContent||'',answer:picked?picked.parentElement.textContent:'Not answered',template:!!picked?.dataset.template};}),
  rows:snapshotRows(form),
  forms:[...document.querySelectorAll('#template-forms .tform')].map(p=>({title:p.querySelector('.form-id').textContent,subtitle:p.querySelector('.form-title').textContent,stamp:p.querySelector('.stamp').textContent,rows:snapshotRows(p)}))
 };
}
async function download(){
 collect();if(!refresh())return;const revision=live.revision;
 try{const blob=await printPdf(pageSnapshot());if(revision!==live.revision){error(Error('Answers changed during generation. Download again to use the latest figures.'));return;}
  const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download=`form1040-${yearOf(answers)}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){error(e);}
}
async function load(){
 try{
  const r=await loadDraft();answers=r.answers;
  // Hypothetical strategy examples have no place in this layout; drop any left from older drafts.
  const hadExamples=Object.keys(answers._examples||{}).length>0;if(hadExamples)answers=removeExamples(answers);
  const before=JSON.stringify(answers);answers=pruneAssessment(answers);const pruned=before!==JSON.stringify(answers);
  renderForm();renderAssessment();refresh();
  $('#save-status').textContent=r.updated?'Saved draft restored':'Ready when you are';
  if(hadExamples||pruned)markDirty();
 }catch(e){error(e);}
}
// Help mode: hovering (or focusing) any part of the form explains it. A left click anywhere
// exits, and that click is swallowed so it does not also change the form.
let helpOn=false,swallowClick=false,helpTarget=null;
const plainFormula=(how,ctx)=>how.replace(/\[([^\]]+)\]/g,(m,token)=>{const ref=resolve(token,ctx);return `${ref.label} (${ref.text})`;});
const helpNote=(text,cls)=>el('p',text,cls);
// Works out what the pointer is over and returns {title, parts} for the tooltip, or null.
function helpFor(node){
 const Y=yearOf(answers),yt=t=>yearText(t,Y);
 const q=node.closest('.assess-q');
 if(q){const key=q.dataset.question,text=quickHints[key];return text?{title:'Quick Assessment',parts:[el('p',q.querySelector('.assess-label').textContent,'help-q'),helpNote(yt(text))]}:null;}
 const paper=node.closest('#template-forms .tform'),row=node.closest('.line');
 if(paper&&row){
  const id=paper.dataset.form,line=row.dataset.row,l=formLine(id,line);if(!l)return null;
  const title=`${paper.querySelector('.form-id').textContent}, line ${line}`,parts=[el('p',l.label,'help-q')];
  if(l.kind){
   parts.push(helpNote(yt(formHelp[`${id.replace(/Spouse$/,'')}:${line}`]||'Enter the amount for this line from your records.')));
   if(l.source==='template')parts.push(helpNote('The amber figure is a template value from your Quick Assessment. Replace it with your actual amount.','help-state'));
  }else parts.push(helpNote('Calculated automatically; you cannot type here.','help-state'),helpNote('= '+plainFormula(l.how,id)+' = '+show(l.value,l.fmt),'help-formula'));
  return {title,parts};
 }
 if(!node.closest('#form1040'))return null;
 if(row){
  const line=row.dataset.row,field=row.querySelector('[data-key]'),key=field?.dataset.key;
  if(row.classList.contains('method'))return {title:'Form 1040, line 12',parts:[el('p','Deduction method','help-q'),helpNote(fieldHelp.deductionMethod)]};
  if(!line)return null;
  const parts=[el('p',row.querySelector('.desc').textContent.replace('ƒx',''),'help-q')];
  if(key&&fieldHelp[key])parts.push(helpNote(yt(fieldHelp[key])));
  const how=how1040(line);
  if(field?.readOnly)parts.push(helpNote(`Filled automatically${field.title.startsWith('From ')?' — '+field.title.replace(/^From /,'from '):''}.`,'help-state'));
  else if(field?.classList.contains('template'))parts.push(helpNote('The amber figure is a template value from your Quick Assessment. Replace it with your actual amount.','help-state'));
  else if(field?.classList.contains('auto'))parts.push(helpNote('Calculated for you; type your own figure to override it.','help-state'));
  else if(!key)parts.push(helpNote('Calculated automatically; you cannot type here.','help-state'));
  if(how)parts.push(helpNote('= '+plainFormula(how,'1040')+' = '+money(value1040(line)),'help-formula'));
  return {title:`Form 1040, line ${line}`,parts};
 }
 const cell=node.closest('.id-cell'),input=cell?.querySelector('[data-key]');
 if(input)return {title:'Form 1040',parts:[el('p',cell.querySelector('label').textContent,'help-q'),helpNote(yt(fieldHelp[input.dataset.key]||''))]};
 const set=node.closest('.check-row'),radio=set?.querySelector('[data-key]');
 if(radio)return {title:'Form 1040',parts:[el('p',set.querySelector('legend').textContent,'help-q'),helpNote(yt(fieldHelp[radio.dataset.key]||''))]};
 const banner=node.closest('#template-banner,.legend');
 if(banner)return {title:'Form status',parts:[helpNote('Amber boxes hold template figures to replace with your actual data. Blue boxes are filled from other lines or forms. Select ƒx beside a calculated line to see its formula.')]};
 return null;
}
function showHelp(node,x,y){
 const tip=$('#help-tip'),info=node&&helpFor(node);
 if(!info){tip.hidden=true;helpTarget?.classList.remove('help-target');helpTarget=null;return;}
 const target=node.closest('.line,.id-cell,.check-row,.assess-q,#template-banner,.legend');
 if(target!==helpTarget){helpTarget?.classList.remove('help-target');helpTarget=target;target?.classList.add('help-target');tip.replaceChildren(el('div',info.title,'help-title'),...info.parts);}
 tip.hidden=false;
 const pad=14,w=tip.offsetWidth||320,h=tip.offsetHeight||120;
 let left=x+pad,top=y+pad;
 if(left+w>window.innerWidth-8)left=Math.max(8,x-w-pad);
 if(top+h>window.innerHeight-8)top=Math.max(8,y-h-pad);
 tip.style.left=left+'px';tip.style.top=top+'px';
}
function setHelp(on){
 helpOn=on;document.body.classList.toggle('help-mode',on);
 const b=$('#help-mode');b.setAttribute('aria-pressed',String(on));b.textContent=on?'Help mode on · click to exit':'? Help mode';
 if(!on){$('#help-tip').hidden=true;helpTarget?.classList.remove('help-target');helpTarget=null;}
}
$('#help-mode').onclick=()=>setHelp(true);
document.addEventListener('mouseover',e=>{if(helpOn)showHelp(e.target,e.clientX,e.clientY);});
document.addEventListener('mousemove',e=>{if(helpOn&&!$('#help-tip').hidden)showHelp(e.target,e.clientX,e.clientY);});
document.addEventListener('focusin',e=>{if(!helpOn)return;const r=e.target.getBoundingClientRect?.();showHelp(e.target,r?r.left:0,r?r.bottom:0);});
document.addEventListener('mousedown',e=>{if(!helpOn||e.button!==0)return;e.preventDefault();e.stopPropagation();swallowClick=true;setHelp(false);},true);
document.addEventListener('click',e=>{if(!swallowClick)return;swallowClick=false;e.preventDefault();e.stopPropagation();},true);
document.addEventListener('keydown',e=>{if(helpOn&&e.key==='Escape')setHelp(false);});
$('#download').onclick=download;
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
load();
