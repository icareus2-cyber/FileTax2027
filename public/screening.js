import {planningGroup} from './strategies.js';
import {yearOf,yearText} from './tax-years.js';
const choices=['Yes','No','Not sure / skip'];
const q=(key,label,hint='')=>[key,label,'check',choices,hint];
export const screeningGroups=[
 {title:'About you',fields:[
 q('reviewUSHome','Was your main home in the United States for more than half of 2025?','Living in the U.S. and being a U.S. tax resident are different questions.'),
 ['reviewJoint','Do you plan to file jointly with your spouse?','select',['Yes, jointly with my spouse','No','Not sure / skip'],'This is a preference to review, not a determination of filing-status eligibility.'],
 q('reviewResident','Were you a U.S. citizen or resident alien for U.S. tax purposes throughout 2025?','If No or unsure, review whether Form 1040, 1040-NR, or dual-status rules apply.'),
 q('reviewW2','Did you receive wages reported on Form W-2?'),
 q('reviewRetired','Were you retired during 2025?','Retirement alone does not determine your taxable income or deduction.'),
 q('reviewBusiness','Did you have self-employment, freelance, gig, or other business income?','Include income reported on Form 1099-NEC or 1099-K and income with no form. Personal payments on a 1099-K are not automatically business income.'),
 q('reviewIRA','Did you contribute, or do you want to review contributions, to a traditional or Roth IRA for 2025?','Check contribution deadlines and eligibility. Roth IRA contributions are not deductible; traditional IRA contributions may be deductible.')
 ]},
 {title:'About your income',fields:[
 q('reviewDividends','Did you receive dividends or capital gain distributions?'),
 q('reviewBroker','Did you sell stocks, bonds, or funds through a broker?'),
 q('reviewDigitalSales','Did you sell, exchange, or otherwise dispose of cryptocurrency or other digital assets?','Receiving digital assets as payment or rewards may also need reporting; the detailed form asks the broader IRS digital asset question.'),
 q('reviewUnreportedBasis','Did you sell other investments whose cost basis was not reported to the IRS?'),
 q('reviewInterest','Did you have more than $1,500 in taxable interest OR more than $1,500 in ordinary dividends?','Consider each total separately, not their combined amount. Review Schedule B.'),
 q('reviewForeign','Did you have a financial interest in or signature authority over a foreign financial account, or involvement with a foreign trust?','Include foreign trust distributions and being a grantor or transferor. Review Schedule B and any separate reporting requirements.'),
 q('reviewRental','Did you receive rental real estate income or royalties?'),
 q('reviewK1','Did you receive Schedule K-1 from a partnership, S corporation, estate, or trust?'),
 q('reviewDistributions','Did you receive IRA, pension, or annuity distributions?'),
 q('reviewSocialSecurity','Did you receive Social Security benefits?'),
 q('reviewOtherIncome','Did you receive unemployment compensation, gambling winnings, prizes, jury duty pay, taxable alimony, or other income?','Alimony is generally taxable under pre-2019 divorce or separation agreements, unless a later modification makes the newer rules apply.')
 ]},
 {title:'Adjustments and deductions',fields:[
 q('reviewAdjustments','Did you pay student loan interest, make HSA or traditional IRA contributions, pay educator expenses, or have self-employed health insurance or retirement plan contributions?','These may qualify for adjustments to income; eligibility and limits must be checked.'),
 q('reviewItemize','Did you pay mortgage interest, state or local taxes, substantial medical expenses, or make charitable gifts that you may itemize?','Compare eligible itemized deductions with your applicable standard deduction.')
 ]},
 {title:'Credits',fields:[
 q('reviewDependents','Do you plan to claim children or other dependents?'),
 q('reviewCare','Did you pay for care of a child under 13, or a spouse or dependent unable to care for themselves, so you could work or look for work?','Eligibility depends on additional requirements; review Form 2441.'),
 q('reviewEducation','Did you pay tuition or other qualified education expenses that may qualify for an education credit?','Review Form 1098-T and Form 8863; not every education expense qualifies.')
 ]},
 {title:'Other taxes',fields:[
 q('reviewHousehold','Did you pay wages to a household employee, such as a nanny or housekeeper?','This asks about wages you paid as an employer. Review Schedule H for household employment taxes.'),
 q('reviewOtherTaxes','Might you owe alternative minimum tax or other additional taxes?','If you do not know, choose Not sure / skip. Review Schedule 2 before completing tax amounts.')
 ]}
];

const legacyFields=screeningGroups.flatMap(g=>g.fields);
const simple=(key,label)=>q(key,label);
export const quickGroups=[
 {title:'About you',fields:[
 simple('reviewUSHome','Was your main home in the U.S. for most of {year}?'),
 simple('quickMarried','Were you married on December 31, {year}?'),
 simple('quickAge65','Were you born before January 2, {born65} (age 65 or older)?'),
 simple('quickBlind','Are you legally blind?'),
 simple('quickClaimedDependent','Can someone else claim you as a dependent on their return?'),
 ['reviewJoint','Do you intend to file jointly with your spouse?','select',['Yes, jointly with my spouse','No','Not sure / skip']],
 simple('quickLivedApart','Did your spouse live somewhere else for the last 6 months of {year}?'),
 simple('quickWidowed','Did your spouse die in {prev2} or {prev}, and did your dependent child live with you all year?'),
 simple('quickHomeHalf','Did you pay more than half the cost of keeping up your home for the year, where a qualifying child or relative lived with you?'),
 simple('reviewW2','Did you have a job that pays wages or a salary?'),
 simple('quickTipsOvertime','Did you receive tips or overtime pay?'),
 simple('reviewRetired','Were you retired?'),
 simple('reviewBusiness','Did you earn money working for yourself or running a business?'),
 simple('quickBusinessReceiptsHigh','Did your business bring in more than $100,000 before expenses?'),
 simple('reviewIRA','Would you like to discuss saving in an IRA?')]},
 {title:'Money you received',fields:[
 simple('reviewRental','Did you receive rent or royalties?'),
 ['quickRentalKind','What kind of rental or royalty income did you receive?','select',['Rent from one property','Rent from multiple properties','Royalties','Both rent and royalties','Not sure / skip'],'This helps choose an appropriate reference example.'],
 simple('planRentalGrossHigh','Did you receive more than $100,000 in rent before expenses?'),
 simple('reviewDividends','Did you receive investment dividends?'),
 simple('reviewBroker','Did you sell stocks, bonds, or investment funds?'),
 simple('reviewDigitalSales','Did you sell or exchange cryptocurrency?'),
 simple('quickInterest','Did you receive interest from savings or investments?'),
 simple('quickForeign','Did you have money or accounts outside the U.S.?'),
 simple('reviewDistributions','Did you receive payments from a retirement account or pension?'),
 ['quickDistKind','What kind of retirement payments were they?','select',['IRA','Pension or annuity','Both','Not sure / skip'],'Form 1099-R shows an IRA/SEP/SIMPLE box when the payment came from an IRA.'],
 simple('quickEarlyWithdrawal','Were you under age 59½ when you took the withdrawal?'),
 simple('reviewSocialSecurity','Did you receive Social Security benefits?'),
 simple('quickUnemployment','Did you receive unemployment benefits?'),
 simple('quickK1','Did you receive a Schedule K-1 from a partnership, S corporation, estate, or trust?'),
 simple('quickOtherIncome','Did you receive any other money besides the income above?')]},
 {title:'Family and spending',fields:[
 simple('quickFamily','Did you financially support children or other family members?'),
 simple('reviewCare','Did you pay someone to care for a child or family member so you could work?'),
 simple('quickEducation','Did you pay college or other higher-education costs?'),
 simple('quickStudentLoan','Did you pay interest on a student loan?'),
 simple('quickEducator','Are you a K–12 teacher or aide who paid for classroom supplies?'),
 simple('quickMarketplace','Did you buy health insurance through the Health Insurance Marketplace (Form 1095-A)?'),
 simple('quickCarLoan','Did you buy a new car for personal use with a loan in {year}?'),
 simple('quickHomeCosts','Did you pay mortgage interest, property taxes, large medical bills, or give to charity?'),
 simple('reviewHousehold','Did you employ a nanny, housekeeper, or another household worker?')]}
];

// Questions about one person are asked for each spouse when both spouses' facts matter.
export const personKeys=['quickAge65','quickBlind','quickTipsOvertime','quickEarlyWithdrawal','quickEducator','reviewW2','reviewRetired','reviewBusiness','quickBusinessReceiptsHigh','reviewIRA','reviewDistributions','reviewSocialSecurity'];
const jointLabels={
 reviewW2:'Did each of you have a job that pays wages or a salary?',
 reviewRetired:'Was each of you retired?',
 reviewBusiness:'Did each of you earn money working for yourself or running a business?',
 quickBusinessReceiptsHigh:'Did the business bring in more than $100,000 before expenses?',
 reviewIRA:'Would each of you like to discuss saving in an IRA?',
 reviewDistributions:'Did each of you receive payments from a retirement account or pension?',
 reviewSocialSecurity:'Did each of you receive Social Security benefits?',
 quickAge65:'Was each of you born before January 2, {born65} (age 65 or older)?',
 quickBlind:'Is either of you legally blind?',
 quickTipsOvertime:'Did each of you receive tips or overtime pay?',
 quickEarlyWithdrawal:'Was each of you under age 59½ when taking the withdrawal?',
 quickEducator:'Is either of you a K–12 teacher or aide who paid for classroom supplies?'
};
const married=a=>a.quickMarried==='Yes';
// A joint return, or an undecided married couple comparing options, needs both spouses' answers.
export const bothSpouses=a=>married(a)&&['Yes, jointly with my spouse','Not sure / skip'].includes(a.reviewJoint);
export const people=a=>bothSpouses(a)?[['','You'],['Spouse','Spouse']]:[['','You']];
const anyone=(a,key)=>people(a).some(([s])=>a[key+s]==='Yes');
const earns=(a,s)=>a['reviewW2'+s]!=='No'||a['reviewBusiness'+s]!=='No';
// Visibility rules; `s` is '' for you or 'Spouse'. Questions without a rule are always asked.
const rules={
 reviewJoint:a=>married(a),
 quickBusinessReceiptsHigh:(a,s)=>a['reviewBusiness'+s]==='Yes',
 quickRentalKind:a=>a.reviewRental==='Yes',
 planRentalGrossHigh:a=>a.reviewRental==='Yes'&&a.quickRentalKind!=='Royalties',
 reviewCare:a=>(a.quickFamily==='Yes'||married(a))&&people(a).some(([s])=>earns(a,s)),
 // Filing-status follow-ups: surviving spouse, head of household, and spouses living apart.
 quickLivedApart:a=>married(a)&&a.reviewJoint==='No'&&a.quickFamily==='Yes',
 quickWidowed:a=>a.quickMarried==='No'&&a.quickFamily==='Yes',
 quickHomeHalf:a=>a.quickFamily==='Yes'&&(a.quickMarried==='No'&&a.quickWidowed!=='Yes'||married(a)&&a.reviewJoint==='No'&&a.quickLivedApart==='Yes'),
 quickTipsOvertime:(a,s)=>a['reviewW2'+s]==='Yes',
 quickDistKind:a=>people(a).some(([s])=>a['reviewDistributions'+s]==='Yes'),
 quickEarlyWithdrawal:(a,s)=>a['reviewDistributions'+s]==='Yes'
};
const quickFields=quickGroups.flatMap(g=>g.fields);
const spouseFields=personKeys.map(k=>{const [,label,type,options,hint]=quickFields.find(f=>f[0]===k);return [k+'Spouse','Spouse: '+label,type,options,hint];});
export const assessmentKeys=[...quickFields.map(f=>f[0]),...spouseFields.map(f=>f[0])];

// Returns only the questions (and per-person rows) that apply to the current answers.
export function assessment(a){
 return quickGroups.map(g=>({title:g.title,items:g.fields.map(([key,label,type,options,hint])=>{
  const per=personKeys.includes(key);
  const rows=(per?people(a):[['','']]).filter(([s])=>!rules[key]||rules[key](a,s)).map(([s,who])=>({key:key+s,who}));
  if(!rows.length)return null;
  return {key,label:yearText(per&&bothSpouses(a)?jointLabels[key]:label,yearOf(a)),type,options,hint:hint&&yearText(hint,yearOf(a)),rows:rows.length>1?rows:[{key:rows[0].key,who:bothSpouses(a)?rows[0].who:''}]};
 }).filter(Boolean)})).filter(g=>g.items.length);
}
const visibleKeys=a=>new Set(assessment(a).flatMap(g=>g.items.flatMap(q=>q.rows.map(r=>r.key))));
// Drops answers to questions that no longer apply, repeating because hiding one can hide its follow-ups.
export function pruneAssessment(input){
 const a={...input};
 if(a.quickMarried===undefined&&a.reviewJoint==='Yes, jointly with my spouse')a.quickMarried='Yes';
 for(let changed=true;changed;){changed=false;const visible=visibleKeys(a);for(const k of assessmentKeys)if(a[k]!==undefined&&!visible.has(k)){delete a[k];changed=true;}}
 return a;
}
export const screeningFields=[...new Map([...legacyFields,...quickFields,...spouseFields].map(f=>[f[0],f])).values()];
export function screeningNotes(input){
 const a=pruneAssessment(input),notes=[];
 const unknown=[...visibleKeys(a)].filter(key=>!a[key]||a[key]==='Not sure / skip').length;
 if(unknown)notes.push(`${unknown} status-review question(s) are unanswered or marked Not sure / skip. Revisit them before finalizing your return.`);
 if(a.reviewResident!=='Yes')notes.push('Confirm U.S. tax residency and the correct return type before using this Form 1040 draft.');
 if(a.reviewJoint==='Yes, jointly with my spouse'){notes.push('Review eligibility to file jointly. A joint return reports both spouses’ income, deductions, and credits.');if(a.status&&a.status!=='Married filing jointly')notes.push(`Your assessment says you will file jointly, but Form 1040 filing status is ${a.status}.`);}
 if(married(a)&&a.reviewJoint==='No'){notes.push('Filing separately limits several benefits, including the earned income, education, and dependent care credits. Compare it with a joint return.');if(a.status&&!['Married filing separately','Head of household'].includes(a.status))notes.push(`You are married and filing separately, but Form 1040 filing status is ${a.status}.`);}
 if(married(a)&&a.reviewJoint==='Not sure / skip')notes.push('Compare filing jointly and separately; answers are collected for both spouses to help.');
 if(married(a)&&['Single','Qualifying surviving spouse'].includes(a.status))notes.push(`Married taxpayers generally cannot use ${a.status} filing status. Review your filing status.`);
 if(a.quickMarried==='No'&&['Married filing jointly','Married filing separately'].includes(a.status))notes.push(`You said you were not married on December 31, ${yearOf(a)}, but Form 1040 uses a married filing status.`);
 if(bothSpouses(a)&&['reviewW2','reviewBusiness'].some(k=>a[k]==='Yes')&&['reviewW2','reviewBusiness'].some(k=>a[k+'Spouse']==='Yes'))notes.push('Both spouses have earned income. Combine both spouses’ W-2s and business results on a joint return; self-employment tax is figured separately for each spouse.');
 for(const [keys,message] of [
 [['reviewBusiness'],'Review business income, expenses, Schedule C (or the applicable business schedule), and Schedule SE.'],
 [['reviewDividends','reviewBroker','reviewDigitalSales','reviewUnreportedBasis'],'Review investment income, Form 8949, and Schedule D as applicable.'],
 [['reviewInterest','reviewForeign','quickInterest','quickForeign'],'Review Schedule B and any applicable foreign account or trust reporting.'],
 [['reviewRental','reviewK1'],'Review rental, royalty, and K-1 amounts and applicable schedules before transferring totals.'],
 [['reviewDistributions','reviewSocialSecurity'],'Determine taxable retirement distributions and Social Security benefits using the applicable worksheets.'],
 [['reviewOtherIncome','reviewAdjustments','quickOtherIncome'],'Review Schedule 1 income and adjustments.'],
 [['reviewIRA'],'Check IRA contribution eligibility, deadlines, and deductibility; Roth IRA contributions are not deductible.'],
 [['reviewItemize','quickHomeCosts'],'Compare Schedule A itemized deductions with your applicable standard deduction.'],
 [['reviewDependents','quickFamily'],'Review dependent eligibility and Schedule 8812.'],
 [['reviewCare'],'Review dependent care credit eligibility and Form 2441.'],
 [['reviewEducation','quickEducation'],'Review education credit eligibility and Form 8863.'],
 [['reviewHousehold'],'Review Schedule H household employment taxes.'],
 [['reviewOtherTaxes'],'Review Schedule 2 and applicable additional-tax forms.']
 ])if(keys.some(k=>anyone(a,k)))notes.push(message);
 return notes;
}
// Plain-language explanations shown by the "?" button beside each quick-assessment question.
export const quickHints={
 reviewUSHome:'Where you actually lived for more than half of {year} (at least 183 days). Living in the U.S. is not the same as being a U.S. tax resident; that is checked separately.',
 quickMarried:'Your marital status on December 31 applies to the whole year. Married couples can file jointly or separately; unmarried people cannot use a married filing status.',
 reviewJoint:'A joint return combines both spouses’ income, deductions, and credits. Choosing Jointly or Not sure asks the questions that differ by person for each of you. Separately asks them only about you.',
 reviewW2:'Wages from an employer are reported on Form W-2, which you should receive by the end of January. Box 1 goes on Form 1040, line 1a.',
 reviewRetired:'Being retired does not by itself change your tax. It helps flag pensions, retirement-account withdrawals, and Social Security benefits to review.',
 reviewBusiness:'Includes freelance, gig, contract, or side-business income, whether reported on Form 1099-NEC, 1099-K, or not reported at all. This is usually filed on Schedule C with Schedule SE.',
 reviewIRA:'A traditional IRA contribution may be deductible; a Roth IRA contribution is not. {year} contributions can generally be made until the April {next} filing deadline.',
 reviewRental:'Rent from property you own, or royalties from things like oil, gas, mineral rights, books, or patents. These are usually reported on Schedule E.',
 quickRentalKind:'Choose the closest description. This app models a single rental property; multiple properties and royalties need separate review.',
 quickBusinessReceiptsHigh:'Total money your business took in before subtracting any costs. Answer No if you have no business.',
 planRentalGrossHigh:'Total rent received during {year} before subtracting repairs, taxes, insurance, or other costs. Answer No if you have no rentals.',
 reviewDividends:'Payments from stocks or mutual funds, usually shown on Form 1099-DIV. Qualified dividends may be taxed at lower rates.',
 reviewBroker:'Sales of stocks, bonds, ETFs, or mutual fund shares, usually shown on Form 1099-B. Gains and losses go on Form 8949 and Schedule D.',
 reviewDigitalSales:'Selling, trading, or spending cryptocurrency or other digital assets. Form 1040 asks every filer a yes/no digital asset question.',
 quickInterest:'Interest from bank accounts, CDs, bonds, or loans you made, usually shown on Form 1099-INT. Over $1,500 requires Schedule B.',
 quickForeign:'Bank, brokerage, or other financial accounts outside the U.S., including accounts you can sign on. These may require extra reporting such as an FBAR.',
 reviewDistributions:'Withdrawals from an IRA, 401(k), pension, or annuity, shown on Form 1099-R. Part or all of the amount may be taxable.',
 reviewSocialSecurity:'Benefits shown on Form SSA-1099. Depending on your other income, up to 85% may be taxable.',
 quickOtherIncome:'For example gambling winnings, prizes, jury duty pay, or alimony under older agreements. Many of these go on Schedule 1.',
 quickFamily:'Children or relatives you supported may qualify as dependents, which can affect filing status and credits such as the child tax credit.',
 reviewCare:'Daycare, babysitters, or care for a disabled spouse or dependent while you worked or looked for work may qualify for the dependent care credit (Form 2441).',
 quickEducation:'Tuition and required fees for college or vocational school, usually shown on Form 1098-T, may qualify for an education credit (Form 8863).',
 quickHomeCosts:'These are itemized deductions on Schedule A. They help only if their total is more than your standard deduction.',
 reviewHousehold:'If you paid a household worker wages above the yearly threshold, you may owe employment taxes on Schedule H. Independent contractors do not count.'
};
Object.assign(quickHints,{
 quickAge65:'You get a larger standard deduction if you were 65 or older at the end of {year}, and the new $6,000 senior deduction (2025–2028). You are treated as 65 on the day before your 65th birthday.',
 quickBlind:'Legally blind means corrected vision of 20/200 or less in the better eye, or a visual field of 20 degrees or less, certified by an eye doctor. It adds to your standard deduction.',
 quickClaimedDependent:'If a parent or someone else can claim you, your standard deduction is limited to your earned income plus $450 (at least $1,350). Answer Yes even if they choose not to claim you.',
 quickLivedApart:'A married person who files separately may use head of household if the spouse lived elsewhere for the last 6 months of the year and they kept up a home for a child.',
 quickWidowed:'A qualifying surviving spouse keeps joint-return tax rates for two years after the spouse’s death, if a dependent child lived with them. If your spouse died in {year}, you can still file jointly for {year}: answer the marriage question Yes.',
 quickHomeHalf:'Head of household requires paying more than half the cost of rent or mortgage, utilities, repairs, property tax, and food for the home, and that a qualifying person lived with you more than half the year.',
 quickTipsOvertime:'Qualified tips and the premium part of overtime pay (the “half” in time-and-a-half) can be deducted on Schedule 1-A for 2025–2028, up to set limits.',
 quickDistKind:'IRA payments are reported on line 4 of Form 1040; pensions, 401(k)s, and annuities on line 5.',
 quickEarlyWithdrawal:'Withdrawals before age 59½ usually owe an extra 10% tax (Form 5329), unless an exception applies, such as disability, first-home purchase (IRA, up to $10,000), or higher-education costs.',
 quickUnemployment:'Unemployment compensation is taxable and reported on Form 1099-G, box 1. Tax withheld is in box 4.',
 quickK1:'Schedule K-1 shows your share of income from a partnership, S corporation, estate, or trust. It is reported on Schedule E, Part II or III.',
 quickStudentLoan:'You can deduct up to $2,500 of student loan interest (Form 1098-E) a year, phasing out at higher incomes. Not available if married filing separately.',
 quickEducator:'Kindergarten through grade 12 teachers, instructors, counselors, principals, or aides who worked at least 900 hours can deduct up to $300 of classroom supplies each.',
 quickMarketplace:'Marketplace coverage (HealthCare.gov or a state exchange) comes with Form 1095-A. The premium tax credit is reconciled on Form 8962: you may get more credit, or repay advance payments.',
 quickCarLoan:'Interest on a loan for a new car, SUV, van, pickup, or motorcycle assembled in the U.S. and bought for personal use after 2024 can be deducted, up to $10,000 a year (2025–2028).'
});
