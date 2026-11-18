import {strategySection} from './planning.js';
import {screeningFields} from './screening.js';
export const sections = [
 {title:'About you', hint:'Start with the details that appear at the top of your return.', fields:[
 ['firstName','What is your first name and middle initial?','text'],['lastName','What is your last name?','text'],
 ['address','Street address','text'],['city','City or town','text'],['state','State (two letters)','state'],['zip','ZIP code','zip'],
 ['status','Which filing status will you use?','select',['Single','Married filing jointly','Married filing separately','Head of household','Qualifying surviving spouse']],
 ['spouseName','Spouse’s full name, if applicable','text'],
 ['digital','Did you receive, sell, exchange, or dispose of digital assets?','select',['No','Yes']],
 ['special','Do any special deduction rules apply?','select',['No','Yes'],'Choose Yes if you are a dual-status alien, or you are married filing separately and your spouse itemizes. Age 65, blindness, and being claimed as a dependent are handled by the Quick Assessment.'],
 ['dependents','Do you have dependents to claim?','select',['No','Yes']],
 ['notes','Dependent details or other information to review','textarea',null,'Do not enter Social Security numbers or bank account numbers in this prototype.'] ]},
 {title:'Income',hint:'Use combined amounts from your tax documents, including your spouse’s for a joint return. Enter 0 when a line does not apply.',fields:[
 ['wages','How much did you earn in W-2 wages?','money',null,'Add box 1 from all W-2 forms. → Line 1a'],
 ['otherWages','Other earned income (lines 1b–1h combined)','money',null,'Allocate to individual wage lines before filing.'],
 ['exemptInterest','Tax-exempt interest','money',null,'→ Line 2a'],['interest','Taxable interest','money',null,'→ Line 2b'],
 ['qualifiedDividends','Qualified dividends','money',null,'→ Line 3a; included in ordinary dividends.'],['dividends','Ordinary dividends','money',null,'→ Line 3b'],
 ['iraGross','Total IRA distributions','money',null,'→ Line 4a'],['ira','Taxable IRA distributions','money',null,'Use your completed taxable amount worksheet. → Line 4b'],
 ['pensionGross','Total pensions and annuities','money',null,'→ Line 5a'],['pension','Taxable pensions and annuities','money',null,'→ Line 5b'],
 ['ssGross','Total Social Security benefits','money',null,'→ Line 6a'],['ss','Taxable Social Security benefits','money',null,'Use the IRS worksheet. → Line 6b'],
 ['gains','Capital gain or deductible loss','signed',null,'Completed Schedule D amount. → Line 7a'],['additionalIncome','Additional income from Schedule 1','signed',null,'Schedule 1, line 10. → Line 8'] ]},
 {title:'Deductions',hint:'We supply the basic standard deduction. Other deductions come from your completed schedules.',fields:[
 ['adjustments','Adjustments to income','money',null,'Schedule 1, line 26. → Line 10'],
 ['deductionMethod','How will you claim deductions?','select',['Basic standard deduction','Enter verified deduction']],
 ['deduction','Verified standard or itemized deduction','money',null,'Required for special deduction rules. Use Schedule A or the IRS worksheet. → Line 12e'],
 ['qbi','Qualified business income deduction','money',null,'Form 8995 or 8995-A. → Line 13a'],['extraDeduction','Additional deductions from Schedule 1-A','money',null,'Schedule 1-A, line 38. → Line 13b'] ]},
 {title:'Tax & credits',hint:'Use the IRS tax table or applicable tax worksheet and completed credit schedules. This assistant does not determine eligibility or calculate these amounts.',fields:[
 ['tax','What is your verified income tax?','money',null,'IRS tax table or applicable tax worksheet. → Line 16'],['schedule2Tax','Additional tax from Schedule 2, line 3','money',null,'→ Line 17'],
 ['childCredit','Child tax credit / credit for other dependents','money',null,'Schedule 8812. → Line 19'],['otherCredits','Other nonrefundable credits','money',null,'Schedule 3, line 8. → Line 20'],['otherTax','Other taxes, including self-employment tax','money',null,'Schedule 2, line 21. → Line 23'] ]},
 {title:'Payments',hint:'Enter what you already paid and refundable credits from your completed schedules.',fields:[
 ['withheld','Federal income tax withheld on W-2s','money',null,'Add box 2 from all W-2s. → Line 25a'],['withheld1099','Federal income tax withheld on 1099s','money',null,'→ Line 25b'],['withheldOther','Federal withholding from other forms','money',null,'→ Line 25c'],['estimated','Estimated payments and prior-year amount applied','money',null,'→ Line 26'],
 ['eic','Earned income credit','money',null,'Verify with the IRS worksheets. → Line 27a'],['actc','Additional child tax credit','money',null,'Schedule 8812. → Line 28'],['education','Refundable American opportunity credit','money',null,'Form 8863, line 8. → Line 29'],['adoption','Refundable adoption credit','money',null,'Form 8839, line 13. → Line 30'],['otherPayments','Other payments and refundable credits','money',null,'Schedule 3, line 15. → Line 31'] ]}
];
export const fields = [...sections.flatMap(s=>s.fields),...screeningFields,...strategySection.fields,['reviewCompleted','Status review visited','select',['Yes']],['taxYear','Tax year','select',['2025','2026']]];
