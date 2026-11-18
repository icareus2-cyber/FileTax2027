import {bothSpouses,assessment} from './screening.js';
import {params,yearOf} from './tax-years.js';
// Key Points: a summary of what the user has told us and the resulting return, plus tax-saving
// strategies that fit those facts. Savings are rough federal income tax estimates at the
// marginal rate; they ignore state tax, phase-outs not modeled here, and payroll taxes.
const r=Math.round,yes=v=>v==='Yes';
const usd=n=>n===null||n===undefined?'—':(n<0?'-$':'$')+Math.abs(r(n)).toLocaleString('en-US');
const isJoint=s=>['Married filing jointly','Qualifying surviving spouse'].includes(s);
export function marginalRate(taxable,status,year){
 if(!taxable||taxable<=0)return 0;const b=params[year].brackets[status]||params[year].brackets.Single,rates=[.10,.12,.22,.24,.32,.35,.37];
 const i=b.findIndex(top=>taxable<=top);return rates[i===-1?6:i];
}
export function keyPoints(answers,built,lines){
 const Y=yearOf(answers),P=params[Y],L=P.limits,m=built?.merged||answers,status=m.status||'Single',joint=isJoint(status);
 const line=k=>lines?.[k]??null,rate=marginalRate(line('15'),status,Y),save=amount=>r(amount*rate);
 const people=bothSpouses(answers)?[['','you'],['Spouse','your spouse']]:[['','you']];
 const who=key=>people.filter(([s])=>yes(answers[key+s])).map(([,n])=>n);
 const both=names=>names.length===2?'you and your spouse':names[0];
 const form=(id,n)=>built?.forms.find(f=>f.id===id)?.lines.find(l=>l.line===n)?.value??0;
 const has=id=>!!built?.forms.some(f=>f.id===id);
 const sumForms=(ids,n)=>ids.filter(has).reduce((t,id)=>t+form(id,n),0);

 // What the user has told us, and where the return stands.
 const facts=[['Tax year',String(Y)],['Filing status',status+(built?.src.status==='template'?' (suggested by your answers)':'')]];
 if(line('9')!==null)facts.push(['Total income (line 9)',usd(line('9'))],['Adjusted gross income (line 11)',usd(line('11a'))],['Deduction (line 12)',usd(line('12e'))+(m.deductionMethod==='Enter verified deduction'?' itemized':' standard')],['Taxable income (line 15)',usd(line('15'))],['Total tax (line 24)',usd(line('24'))],['Total payments (line 33)',usd(line('33'))]);
 if(line('34')>0)facts.push(['Refund (line 34)',usd(line('34'))]);else if(line('37')!==null)facts.push(['Amount you owe (line 37)',usd(line('37'))]);
 if(line('15')!==null)facts.push(['Tax bracket',Math.round(rate*100)+'%']);
 if(line('9')>0&&line('24')!==null)facts.push(['Effective rate (line 24 ÷ line 9)',(Math.round(line('24')/line('9')*1000)/10)+'%']);
 const income=[];
 const src=(key,label,amount)=>{const n=who(key);if(n.length)income.push(`${label} — ${both(n)}${amount?`: ${usd(amount)}`:''}`);};
 src('reviewW2','Wages',m.wages);src('reviewBusiness','Self-employment',sumForms(['c','cSpouse'],'31'));
 if(yes(answers.reviewRental))income.push(`Rent or royalties${has('e')?`: ${usd(form('e','26'))} net`:''}`);
 if(yes(answers.quickInterest))income.push(`Interest: ${usd(line('2b'))}`);
 if(yes(answers.reviewDividends))income.push(`Dividends: ${usd(line('3b'))}`);
 if(yes(answers.reviewBroker)||yes(answers.reviewDigitalSales))income.push(`Investment sales${yes(answers.reviewDigitalSales)?' (including crypto)':''}: ${usd(line('7a'))} gain or (loss)`);
 src('reviewDistributions','Retirement distributions');src('reviewSocialSecurity','Social Security');
 if(yes(answers.quickUnemployment))income.push(`Unemployment: ${usd(form('1','7'))}`);
 if(yes(answers.quickK1))income.push(`Schedule K-1 income: ${usd(form('e','32')+form('e','37'))}`);
 if(yes(answers.quickOtherIncome))income.push('Other income');
 const formsUsed=built?[...new Set(built.forms.map(f=>f.title+(f.id.endsWith('Spouse')?' (spouse)':'')))]:[];
 const cautions=[];
 if(built?.remaining)cautions.push(`${built.remaining} figures are still template values, so these totals and savings are illustrations until you replace them with your actual data.`);
 const open=assessment(answers).flatMap(g=>g.items.flatMap(q=>q.rows)).filter(row=>!answers[row.key]).length;
 if(open)cautions.push(`${open} Quick Assessment question${open===1?' is':'s are'} unanswered; answering can add strategies.`);
 if(answers.reviewUSHome==='No')cautions.push('You did not live in the U.S. for most of the year; residency rules may change which return and strategies apply.');

 // Strategies that fit these facts.
 const strategies=[];
 const add=(title,why,action,amount,url,note='')=>strategies.push({title,why,action,saving:amount>0?`Estimated federal tax saving: about ${usd(amount)}${note} at your ${Math.round(rate*100)}% bracket.`:null,amount:amount||0,url});
 const perThousand=rate?` Each $1,000 saves about ${usd(save(1000))} in federal income tax at your ${Math.round(rate*100)}% bracket.`:'';
 const wageEarners=who('reviewW2'),business=who('reviewBusiness');
 if(wageEarners.length)add('Raise workplace retirement contributions',`${both(wageEarners)[0].toUpperCase()+both(wageEarners).slice(1)} ${wageEarners.length===2?'have':'has'} W-2 wages.`,`Pre-tax 401(k), 403(b), or TSP contributions reduce taxable wages: up to ${usd(L.k401)} per person for ${Y}, plus ${usd(L.k401CatchUp)} if 50 or older. Form W-2 box 12 (code D, E, or AA) shows what you already contributed. Changes must go through payroll by December 31.${perThousand}`,0,'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-401k-and-profit-sharing-plan-contributions-limits');
 if(business.length){
  const base=sumForms(['c','cSpouse'],'31')-sumForms(['se','seSpouse'],'13'),room=Math.min(L.sep*business.length,r(Math.max(0,base)*.2));
  add('Open a SEP-IRA or solo 401(k)',`${both(business)[0].toUpperCase()+both(business).slice(1)} ${business.length===2?'have':'has'} self-employment profit of ${usd(sumForms(['c','cSpouse'],'31'))}.`,`A SEP-IRA allows about 20% of net self-employment earnings (after half of SE tax): about ${usd(room)} here, up to ${usd(L.sep)} per person. A solo 401(k) can allow more at lower profits. SEP contributions can be made until your filing deadline, including extensions. They lower income tax but not self-employment tax.`,save(room),'https://www.irs.gov/retirement-plans/simplified-employee-pension-plan-sep',' if you contribute the maximum');
  const home=sumForms(['c','cSpouse'],'30');
  add('Claim every business deduction',`Your Schedule C shows ${usd(sumForms(['c','cSpouse'],'28'))} of expenses${home?'':' and no home-office deduction'}.`,`Keep receipts for supplies, software, phone and internet (business share), insurance, and professional fees. ${home?'':'If you use part of your home regularly and exclusively for business, the simplified home-office method allows $5 per square foot up to 300 square feet ($1,500). '}Business driving can be deducted at the ${Y} standard mileage rate (${L.mileage} per mile). Self-employed health insurance premiums are deductible on Schedule 1.`,home?0:save(1500),'https://www.irs.gov/businesses/small-businesses-self-employed/home-office-deduction',home?'':' from a $1,500 home office');
  if(!line('26'))add('Make quarterly estimated payments',`Self-employment income usually has no withholding.`,`Pay estimated tax by April 15, June 15, September 15, and January 15 (Form 1040-ES) to avoid an underpayment penalty. You are generally safe paying 100% of last year’s tax (110% if last year’s AGI was over $150,000).`,0,'https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes');
 }
 const iraPeople=who('reviewIRA').length?who('reviewIRA'):[...new Set([...wageEarners,...business])];
 if(iraPeople.length){
  const already=form('1','20'),room=Math.max(0,L.ira*iraPeople.length-already);
  if(rate&&rate<=.12)add('Consider a Roth IRA',`Your ${Math.round(rate*100)}% bracket is low.`,`A Roth IRA gives no deduction now, but qualified withdrawals are tax-free later, which usually beats a deduction at a 10–12% rate. The limit is ${usd(L.ira)} per person for ${Y} (${usd(L.iraCatchUp)} more if 50 or older); contributions for ${Y} can be made until April 15, ${Y+1}.`,0,'https://www.irs.gov/retirement-plans/roth-iras');
  else if(room)add('Contribute to a traditional IRA',`${already?`Your return includes ${usd(already)} of IRA deductions; `:''}${both(iraPeople)[0].toUpperCase()+both(iraPeople).slice(1)} can contribute up to ${usd(L.ira)} each for ${Y}.`,`Traditional IRA contributions made by April 15, ${Y+1} can be deducted on Schedule 1, line 20. The deduction phases out if you are covered by a workplace plan and income is above the IRS limits; check the IRA Deduction Worksheet.`,save(room),'https://www.irs.gov/retirement-plans/ira-deduction-limits',' for the remaining contribution room');
 }
 if(wageEarners.length||business.length)add('Use a health savings account (HSA)','HSA contributions are deductible (or pre-tax through payroll) if you have a high-deductible health plan.',`For ${Y} you can contribute up to ${usd(L.hsaSelf)} for self-only coverage or ${usd(L.hsaFamily)} for family coverage (plus $1,000 at 55 or older). Withdrawals for medical costs are tax-free.`,save(joint||yes(answers.quickFamily)?L.hsaFamily:L.hsaSelf),'https://www.irs.gov/publications/p969',' if you are eligible and contribute the maximum');
 if(yes(answers.quickFamily)){
  add('Claim the child tax credit for every qualifying child','You support children or other family members.',`Each child under 17 with a Social Security number is worth up to ${usd(P.childCredit)}; other dependents up to $500. Make sure each child’s SSN is valid for employment and they lived with you more than half the year.`,0,'https://www.irs.gov/credits-deductions/individuals/child-tax-credit');
  if(wageEarners.length)add('Use a dependent care FSA',yes(answers.reviewCare)?'You pay for child or dependent care so you can work.':'You support children; care costs may qualify.',`An employer dependent care FSA lets you pay up to ${usd(L.careFsa)} of care costs pre-tax for ${Y}, saving income tax plus 7.65% payroll tax. Amounts used this way cannot also be claimed for the Form 2441 credit.`,save(L.careFsa),'https://www.irs.gov/publications/p503',' plus payroll tax');
  if(status==='Single'&&!yes(answers.quickMarried)&&answers.quickHomeHalf!=='No')add('Check head of household status','You are unmarried and support family members.',`Head of household has a larger standard deduction (${usd(P.standard['Head of household'])} vs ${usd(P.standard.Single)}) and wider tax brackets if you paid more than half the cost of keeping up a home for a qualifying person.`,save(P.standard['Head of household']-P.standard.Single),'https://www.irs.gov/newsroom/choosing-the-correct-filing-status',' from the larger standard deduction alone');
 }
 if(yes(answers.quickEducation))add('Choose the best education credit','You paid higher-education costs.',`The American opportunity credit is worth up to $2,500 per student for the first four years of college (40% refundable); the lifetime learning credit is up to $2,000 per return for other courses. Only one can be claimed per student per year. 529 plan withdrawals for the same costs cannot also be used for a credit.`,0,'https://www.irs.gov/credits-deductions/individuals/aotc');
 if(yes(answers.quickMarried)&&answers.reviewJoint!=='Yes, jointly with my spouse')add('Compare joint and separate returns','You are married and not filing jointly (or not sure).','Filing jointly usually gives the lowest tax: separate returns lose the education credits and most of the dependent care credit, and halve several limits. Separate returns can still help in special cases, such as income-driven student loan payments or large medical costs for one spouse.',0,'https://www.irs.gov/newsroom/choosing-the-correct-filing-status');
 if(has('a')){
  const itemized=form('a','17'),std=P.standard[status]??0;
  // Bunching moves next year's gifts into this year: the gain is how far that lifts itemizing above the standard deduction.
  const gifts=form('a','11')+form('a','12');
  if(itemized<std&&itemized+gifts>std)add('Bunch deductions into one year',`Your itemized deductions (${usd(itemized)}) are just below the ${usd(std)} standard deduction.`,`Giving two years of charitable gifts in one year (for example through a donor-advised fund) lifts that year to about ${usd(itemized+gifts)}; take the standard deduction the other year. Timing property tax payments works the same way.`,save(Math.max(0,itemized+gifts-std)),'https://www.irs.gov/charities-non-profits/charitable-organizations/charitable-contribution-deductions',' over two years');
  else if(itemized>=std)add('Keep itemizing records',`Itemizing (${usd(itemized)}) beats the standard deduction by ${usd(itemized-std)}.`,`Keep Form 1098, property tax bills, and charity receipts (a written acknowledgment for any gift of $250 or more). State and local taxes are capped at ${usd(P.salt.cap)} for ${Y}.${Y>=2026?' From 2026, charitable gifts count only above 0.5% of AGI for itemizers.':''}`,0,'https://www.irs.gov/taxtopics/tc501');
 }
 if(L.charityNonItemizer&&m.deductionMethod!=='Enter verified deduction')add('Deduct cash gifts without itemizing',`From ${Y}, people who take the standard deduction can deduct cash gifts to charity.`,`Up to ${usd(L.charityNonItemizer*(joint?2:1))} of cash gifts to qualifying charities (not donor-advised funds) can be deducted on top of the standard deduction. Keep receipts.`,save(L.charityNonItemizer*(joint?2:1)),'https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions',' if you give that much');
 if(Y===2025&&yes(answers.quickHomeCosts))add('Claim home energy credits before they end','You own a home.','Energy-efficient improvements (insulation, windows, heat pumps) placed in service in 2025 can earn up to $3,200 a year (Form 5695), and solar or battery systems 30% of cost. Both credits end for property placed in service after 2025.',0,'https://www.irs.gov/credits-deductions/home-energy-tax-credits');
 if(yes(answers.reviewBroker)||yes(answers.reviewDigitalSales)||yes(answers.reviewDividends)){
  const zeroTop=P.zeroRateTop[status];
  if(line('15')!==null&&line('15')<zeroTop)add('Harvest gains at 0%',`Your taxable income (${usd(line('15'))}) is below the ${usd(zeroTop)} top of the 0% capital gains rate.`,`You could sell long-term investments with gains of up to about ${usd(zeroTop-line('15'))} and pay no federal tax on them, then rebuy to raise your cost basis.`,0,'https://www.irs.gov/taxtopics/tc409');
  else add('Harvest losses and hold for the long term','You have investment sales or dividends.','Selling investments at a loss offsets gains, plus up to $3,000 of other income a year (the rest carries forward). Holding more than one year gets the lower long-term rates. For stocks and funds, avoid rebuying the same investment within 30 days (wash sale rule).',save(3000),'https://www.irs.gov/taxtopics/tc409',' from a $3,000 loss against other income');
 }
 if(wageEarners.length||yes(answers.reviewRetired)||who('quickAge65').length)add('Check the new Schedule 1-A deductions',`Line 13b is ${usd(m.extraDeduction??0)}.`,`For 2025–2028 you may deduct qualified overtime premium pay (up to $12,500; $25,000 joint), qualified tips (up to $25,000), interest on a loan for a new U.S.-assembled car (up to $10,000), and an extra $6,000 per person age 65 or older (answer the age question in the Quick Assessment). Each phases out at higher incomes, and married couples must file jointly for all but the car loan interest.${perThousand}`,0,'https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions');
 if(yes(answers.quickStudentLoan))add('Deduct student loan interest',`Your return includes ${usd(form('1','21'))} of student loan interest deduction.`,`Up to $2,500 of interest on qualified student loans (Form 1098-E) is deductible without itemizing. It phases out between ${usd(P.studentLoan.start.single)} and ${usd(P.studentLoan.start.single+P.studentLoan.range.single)} of modified AGI (${usd(P.studentLoan.start.joint)}–${usd(P.studentLoan.start.joint+P.studentLoan.range.joint)} joint) and is not allowed when married filing separately.`,save(Math.min(P.studentLoan.max,form('1','21i'))-form('1','21')),'https://www.irs.gov/taxtopics/tc456',' if the full interest were deductible');
 if(who('quickEducator').length)add('Deduct educator expenses',`${both(who('quickEducator'))[0].toUpperCase()+both(who('quickEducator')).slice(1)} ${who('quickEducator').length===2?'are':'is an'} eligible educator${who('quickEducator').length===2?'s':''}.`,`Up to ${usd(P.educator)} per educator of classroom supplies, books, software, and professional development can be deducted without itemizing. Keep receipts.`,save(P.educator*who('quickEducator').length),'https://www.irs.gov/taxtopics/tc458',' for the full amount');
 if(has('eic'))add('Check the earned income credit',`Your earned income credit is ${usd(line('27a'))}.`,`The EIC depends on earned income, AGI, and qualifying children (under 19, or under 24 if a student, living with you more than half the year). Investment income must be ${usd(P.eic.investLimit)} or less. Make sure every qualifying child is counted and has a valid SSN; without children you must be 25–64.`,0,'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc');
 if(has('8962'))add('Reconcile your marketplace premium credit',`Advance credit payments must be reconciled on Form 8962.`,`Enter the three column totals from Form 1095-A and your family size. If your income ended up lower than estimated you get more credit; if higher you repay some advance payments${P.ptcRepayCap?' (limited below 400% of the poverty line)':' (no repayment limit from 2026)'}. Report income changes to the Marketplace during the year to avoid a surprise.`,0,'https://www.irs.gov/affordable-care-act/individuals-and-families/the-premium-tax-credit-the-basics');
 if(form('2','8')>0)add('Check for an early-withdrawal exception',`Your return includes a ${usd(form('2','8'))} additional tax on early withdrawals.`,'The 10% additional tax does not apply to IRA withdrawals for a first home (up to $10,000), higher-education costs, health insurance while unemployed, or medical costs over 7.5% of AGI, or to plan payments after separating from service at 55 or older. If an exception applies, file Form 5329 and lower this amount; each exempt dollar saves 10 cents.',0,'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions');
 if(form('2','1')>0||form('2','12')>0)add('Review the alternative minimum and investment income taxes',`Your return includes ${form('2','1')?`${usd(form('2','1'))} of AMT`:''}${form('2','1')&&form('2','12')?' and ':''}${form('2','12')?`${usd(form('2','12'))} of net investment income tax`:''}.`,'Timing large capital gains, spreading income across years, and holding investments in retirement accounts can reduce these taxes. Municipal bond interest is exempt from the net investment income tax.',0,'https://www.irs.gov/individuals/net-investment-income-tax');
 if(yes(answers.reviewRetired)||who('reviewDistributions').length){
  add('Plan retirement withdrawals','You are retired or take retirement distributions.',`If you are 70½ or older, a qualified charitable distribution (up to ${usd(L.qcd)} for ${Y}) sent directly from your IRA to charity counts toward required minimum distributions without being taxed. Spreading withdrawals over years can keep you in a lower bracket${who('reviewSocialSecurity').length?' and reduce how much Social Security is taxable':''}.`,0,'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras-distributions-withdrawals');
 }
 if(yes(answers.reviewRental))add('Depreciate the rental and track every expense','You have rental or royalty income.','Residential rental buildings (not land) are depreciated over 27.5 years. Deduct repairs, insurance, mortgage interest, property tax, management fees, and travel for the rental. If you actively participate, up to $25,000 of rental losses can offset other income when modified AGI is under $100,000.',0,'https://www.irs.gov/publications/p527');
 if(yes(answers.quickForeign))add('Claim the foreign tax credit','You have money or accounts outside the U.S.','Foreign taxes withheld on foreign dividends or interest can be credited dollar-for-dollar against U.S. tax (up to $300, or $600 joint, without Form 1116). Also file the FBAR if foreign accounts totaled more than $10,000.',0,'https://www.irs.gov/individuals/international-taxpayers/foreign-tax-credit');
 if(line('34')>=2000)add('Adjust your withholding',`You are due a ${usd(line('34'))} refund.`,'A large refund is an interest-free loan to the IRS. Updating Form W-4 with the IRS Tax Withholding Estimator raises take-home pay during the year; it does not change your total tax.',0,'https://www.irs.gov/individuals/tax-withholding-estimator');
 else if(line('37')>=1000)add('Avoid an underpayment penalty',`You owe ${usd(line('37'))}.`,'Owing $1,000 or more can bring a penalty unless withholding and estimated payments covered 90% of this year’s tax or 100% of last year’s (110% if AGI was over $150,000). Increase W-4 withholding or make estimated payments.',0,'https://www.irs.gov/individuals/tax-withholding-estimator');
 // How each strategy can be applied to the return. target is '1040:<answer key>' or
 // 'form:<form id>:<line>'; mode 'set' replaces the value, 'add' adjusts it by sign × amount,
 // 'status' changes the filing status, and 'note' only records the choice.
 const cap=x=>x*people.length;
 const opt=(id,label,target,mode,input,extra={})=>({id,label,target,mode,input,...extra});
 const perBusiness=make=>people.filter(([s])=>yes(answers['reviewBusiness'+s])&&has('c'+s)).flatMap(([s])=>make('c'+s,business.length>1?(s?' — spouse’s business':' — your business'):'',s));
 const applyMap={
  'Raise workplace retirement contributions':[opt('401k','Extra pre-tax 401(k) / 403(b) contribution (lowers W-2 wages, line 1a)','1040:wages','add','money',{sign:-1,max:cap(L.k401+L.k401CatchUp)})],
  'Open a SEP-IRA or solo 401(k)':[opt('sep','SEP-IRA or solo 401(k) contribution','form:1:16','set','money',{max:cap(L.sep)})],
  'Claim every business deduction':[
   ...perBusiness((c,who,s)=>[opt('home-office'+s,'Home office, simplified method'+who,'form:'+c+':30','set','sqft',{max:300,factor:5}),opt('mileage'+s,'Business miles driven at '+L.mileage+' per mile'+who,'form:'+c+':28','add','miles',{factor:L.mileageRate}),opt('expenses'+s,'Other business expenses not yet included'+who,'form:'+c+':28','add','money')]),
   opt('se-health','Self-employed health insurance premiums','form:1:17','set','money')],
  'Make quarterly estimated payments':[opt('estimated','Estimated tax payments you made','1040:estimated','set','money')],
  'Contribute to a traditional IRA':[opt('trad-ira','Deductible traditional IRA contribution','form:1:20','set','money',{max:cap(L.ira+L.iraCatchUp)}),opt('roth-ira','Roth IRA contribution instead (no deduction; recorded only)',null,'note','money',{max:cap(L.ira+L.iraCatchUp)})],
  'Consider a Roth IRA':[opt('roth-ira','Roth IRA contribution (no deduction; recorded only)',null,'note','money',{max:cap(L.ira+L.iraCatchUp)}),opt('trad-ira','Deductible traditional IRA contribution instead','form:1:20','set','money',{max:cap(L.ira+L.iraCatchUp)})],
  'Use a health savings account (HSA)':[opt('hsa','HSA contribution made directly (Schedule 1, line 13)','form:1:13','set','money',{max:L.hsaFamily+1000}),opt('hsa-payroll','HSA contribution through payroll (lowers W-2 wages)','1040:wages','add','money',{sign:-1,max:L.hsaFamily+1000})],
  'Claim the child tax credit for every qualifying child':has('8812')?[opt('children','Number of qualifying children under 17','form:8812:4','set','count',{max:20}),opt('other-dependents','Number of other dependents','form:8812:6','set','count',{max:20})]:[],
  'Use a dependent care FSA':[opt('care-fsa','Dependent care FSA amount (lowers W-2 wages)','1040:wages','add','money',{sign:-1,max:L.careFsa})],
  'Check head of household status':[opt('hoh','Use head of household filing status','1040:status','status','none',{status:'Head of household'})],
  'Choose the best education credit':has('8863')?[opt('aotc','Qualified education expenses for the American opportunity credit','form:8863:27','set','money',{max:4000})]:[],
  'Compare joint and separate returns':[opt('mfj','File jointly (Married filing jointly)','1040:status','status','none',{status:'Married filing jointly'}),opt('mfs','File separately (Married filing separately)','1040:status','status','none',{status:'Married filing separately'})],
  'Bunch deductions into one year':[opt('bunch-gifts','Charitable gifts given this year (Schedule A, line 11)','form:a:11','set','money')],
  'Claim home energy credits before they end':[opt('energy','Residential energy credit from Form 5695','form:3:5','set','money')],
  'Check the new Schedule 1-A deductions':[
   opt('overtime','Qualified overtime premium pay (Schedule 1-A)','form:s1a:21i','set','money'),
   opt('tips','Qualified tips received (Schedule 1-A)','form:s1a:13i','set','money'),
   opt('car-loan','Interest on a loan for a new U.S.-assembled car (Schedule 1-A)','form:s1a:30i','set','money')],
  'Deduct student loan interest':[opt('student-loan','Student loan interest paid (Form 1098-E)','form:1:21i','set','money')],
  'Deduct educator expenses':[opt('educator','Classroom expenses paid by eligible educators','form:1:11','set','money',{max:cap(P.educator)})],
  'Check the earned income credit':has('eic')?[opt('eic-kids','Number of qualifying children for the EIC','form:eic:1','set','count',{max:10})]:[],
  'Reconcile your marketplace premium credit':has('8962')?[opt('ptc-premium','Annual premiums (Form 1095-A, column A)','form:8962:11a','set','money'),opt('ptc-slcsp','Second lowest cost silver plan premium (column B)','form:8962:11b','set','money'),opt('ptc-advance','Advance credit payments (column C)','form:8962:11f','set','money'),opt('ptc-size','Tax family size','form:8962:1','set','count',{max:20})]:[],
  'Check for an early-withdrawal exception':has('2')?[opt('early-tax','Additional 10% tax after exceptions (Form 5329)','form:2:8','set','money')]:[],
  'Plan retirement withdrawals':[opt('qcd','Qualified charitable distribution from your IRA (lowers taxable line 4b)','1040:ira','add','money',{sign:-1,max:cap(L.qcd)})],
  'Depreciate the rental and track every expense':has('e')?[opt('depreciation','Rental depreciation (adds to Schedule E expenses)','form:e:20','add','money'),opt('rental-expenses','Other rental expenses not yet included','form:e:20','add','money')]:[],
  'Claim the foreign tax credit':[opt('ftc','Foreign taxes paid (credit on Schedule 3, line 1)','form:3:1','set','money',{max:joint?600:300})]
 };
 for(const s of strategies){s.id=s.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');s.apply=applyMap[s.title]||[];}
 strategies.sort((a,b)=>b.amount-a.amount);
 return {year:Y,rate,facts,income,forms:formsUsed,cautions,strategies};
}
