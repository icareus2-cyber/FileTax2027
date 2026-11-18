import {planningGroup} from './strategies.js';
import {liveFields} from './form-inputs.js';
const amount=(key,label,hint)=>[key,label,'money',null,hint];
export const strategySection={title:'Strategy & amounts',hint:'Enter estimates for one sole-proprietor business and one rental property for 2025. Supported forms update immediately. Enter zero for amounts that do not apply; blanks leave dependent totals incomplete.',fields:[
 ['reviewResident','Were you a U.S. citizen or resident alien for tax purposes throughout 2025?','select',['Yes','No','Not sure / skip'],'Confirm this before applying individual-return tax strategies.'],
 amount('strategyBusinessReceipts','Self-employment: total receipts','Before expenses. Use your records, not a desired tax result.'),
 amount('strategyBusinessExpenses','Self-employment: estimated operating expenses','Business portion only. Include ordinary and necessary operating costs supported by records; exclude personal spending, capital purchases, and amounts counted elsewhere.'),
 amount('strategyRentalReceipts','Rental: total rents received','Before rental expenses.'),
 amount('strategyRentalExpenses','Rental: estimated operating expenses','Rental portion of eligible costs such as management, insurance, repairs, and property taxes. Exclude improvements, loan principal, and depreciation from this operating-cost total.'),
 amount('strategyTraditionalIRA','Traditional IRA contributions already made for 2025','Contributions are not automatically deductible. Keep rollover amounts separate.'),
 amount('strategyRothIRA','Roth IRA contributions already made for 2025','Roth IRA contributions are not deductible. Keep conversions and rollovers separate.'),
 amount('strategyIRABudget','Additional IRA contribution amount you want to evaluate','A planning amount, not an approved contribution or deduction. Verify the applicable year, compensation, age, income limits, existing contributions, and deadlines first.'),
 ['strategyIRAType','Which IRA would you like to evaluate?','select',['Traditional IRA','Roth IRA','Compare both','Not sure / skip']],
 ...liveFields,
 ...planningGroup.fields.map(([key,label,type,options,hint])=>[key,label,type==='check'?'select':type,options,hint])
]};
export function planningSummary(a){
 const difference=(receipts,expenses)=>a[receipts]===undefined||a[expenses]===undefined?null:Math.round((a[receipts]-a[expenses])*100)/100;
 return {businessOperatingSurplus:difference('strategyBusinessReceipts','strategyBusinessExpenses'),rentalOperatingSurplus:difference('strategyRentalReceipts','strategyRentalExpenses')};
}
