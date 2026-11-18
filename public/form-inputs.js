const amount=(key,label,hint,type='money')=>[key,label,type,null,hint];
export const liveFields=[
 amount('businessReturns','Business: returns and allowances','Estimated customer refunds; enter 0 if none.'),
 amount('businessCOGS','Business: cost of goods sold','Enter your estimated inventory-cost result, or 0 if none. Inventory detail is not generated.'),
 amount('businessOther','Business: other business income','Enter 0 if none.'),
 amount('businessDepreciation','Business: depreciation and other non-operating deductions','Estimated amount in addition to operating expenses. Do not count any expense twice.'),
 amount('businessHome','Business: allowable home-office expense','Estimated allowable amount; enter 0 if none.'),
 amount('businessAllowedLoss','Business: allowable loss after limitations','Only needed for a net loss. Enter a positive loss amount after reviewing applicable limits; 0 means none is deductible.'),
 ['rentalAddress','Rental property address (one property)','text'],
 amount('rentalDepreciation','Rental: depreciation','Estimated depreciation in addition to operating costs; enter 0 if none.'),
 amount('rentalAllowedLoss','Rental: allowable loss after limitations','Only needed for a loss. Enter a positive allowable loss, or 0 if none. The app does not calculate passive-activity limits.'),
 amount('liveOtherIncome','Other Schedule 1 income, excluding this business and rental','Enter a combined estimate of remaining Schedule 1 income, or 0 if none. This replaces the manually transferred total when related forms are active.','signed'),
 amount('liveIRADeduction','Estimated deductible traditional IRA contribution','Enter 0 if none. This is the deductible portion, not a Roth contribution or your planned contribution budget.'),
 amount('liveOtherAdjustments','Other Schedule 1 adjustments, excluding the IRA deduction','Include estimated eligible adjustments such as the deductible part of self-employment tax. Enter 0 if none.')
];
