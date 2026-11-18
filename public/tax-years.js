// Figures that change by tax year. 2025: Rev. Proc. 2024-40 as amended by P.L. 119-21 (One Big
// Beautiful Bill Act); 2026: Rev. Proc. 2025-32, the 2026 SSA wage base, and P.L. 119-21.
// Final 2026 forms and instructions were not yet published when these were entered.
export const taxYears=['2025','2026'];
export const yearOf=a=>a?.taxYear==='2026'?2026:2025;
// Credit rates are whole percentages; rounding avoids floating-point remainders.
const pct=x=>Math.round(x*100)/100;
const statuses=(single,joint,mfs,hoh)=>({'Single':single,'Married filing jointly':joint,'Qualifying surviving spouse':joint,'Married filing separately':mfs,'Head of household':hoh});
export const params={
 2025:{
  standard:statuses(15750,31500,15750,23625),
  brackets:statuses([11925,48475,103350,197300,250525,626350],[23850,96950,206700,394600,501050,751600],[11925,48475,103350,197300,250525,375800],[17000,64850,103350,197300,250500,626350]),
  zeroRateTop:statuses(48350,96700,48350,64750),fifteenRateTop:statuses(533400,600050,300000,566700),
  ssWageBase:176100,householdMin:2800,childCredit:2200,
  salt:{cap:40000,threshold:500000,floor:10000},qbiThreshold:{single:197300,joint:394600},
  extraStd:{married:1600,unmarried:2000},dependentStd:{min:1350,plus:450},
  // Figures set by statute that do not change between 2025 and 2026.
  studentLoan:{max:2500,start:{single:85000,joint:170000},range:{single:15000,joint:30000}},educator:300,
  schedule1A:{tips:25000,overtime:{single:12500,joint:25000},tipStart:{single:150000,joint:300000},car:10000,carStart:{single:100000,joint:200000},senior:6000,seniorStart:{single:75000,joint:150000}},
  niit:{joint:250000,mfs:125000,other:200000},addlMedicare:{joint:250000,mfs:125000,other:200000},
  actc:{perChild:1700,floor:2500},
  // EIC by number of qualifying children (0, 1, 2, 3+): phase-in and phase-out rates and thresholds.
  eic:{investLimit:11950,kids:[{max:649,inRate:.0765,outRate:.0765,single:10620,joint:17730},{max:4328,inRate:.34,outRate:.1598,single:23350,joint:30470},{max:7152,inRate:.40,outRate:.2106,single:23350,joint:30470},{max:8046,inRate:.45,outRate:.2106,single:23350,joint:30470}]},
  amt:{exempt:{single:88100,joint:137000,mfs:68500},phaseStart:{single:626350,joint:1252700,mfs:626350},phaseRate:.25,breakpoint:{normal:239100,mfs:119550}},
  // Premium tax credit: 2024 poverty guidelines; applicable figure by income as a multiple of the poverty line (no 400% cap in 2025).
  fpl:{base:15060,per:5380},ptc:[[0,1.5,0,0],[1.5,2,0,.02],[2,2.5,.02,.04],[2.5,3,.04,.06],[3,4,.06,.085],[4,Infinity,.085,.085]],ptcFloor:1,ptcRepayCap:[[2,375,750],[3,975,1950],[4,1625,3250]],
  limits:{k401:23500,k401CatchUp:7500,ira:7000,iraCatchUp:1000,sep:70000,hsaSelf:4300,hsaFamily:8550,careFsa:5000,qcd:108000,mileage:'70 cents',mileageRate:.70,charityNonItemizer:0},
  // Dependent care credit: 35% less 1% per $2,000 of AGI over $15,000, not below 20%.
  careRate:(agi)=>pct(agi<=15000?.35:Math.max(.2,.35-Math.ceil((agi-15000)/2000)*.01)),careText:'35% minus 1% for each $2,000 of [1040:11] over $15,000, not below 20%'
 },
 2026:{
  standard:statuses(16100,32200,16100,24150),
  brackets:statuses([12400,50400,105700,201775,256225,640600],[24800,100800,211400,403550,512450,768700],[12400,50400,105700,201775,256225,384350],[17700,67450,105700,201750,256200,640600]),
  zeroRateTop:statuses(49450,98900,49450,66200),fifteenRateTop:statuses(545500,613700,306850,579600),
  ssWageBase:184500,householdMin:3000,childCredit:2200,
  salt:{cap:40400,threshold:505000,floor:10000},qbiThreshold:{single:201750,joint:403500},
  extraStd:{married:1650,unmarried:2050},dependentStd:{min:1350,plus:450},
  // Figures set by statute that do not change between 2025 and 2026.
  studentLoan:{max:2500,start:{single:85000,joint:170000},range:{single:15000,joint:30000}},educator:300,
  schedule1A:{tips:25000,overtime:{single:12500,joint:25000},tipStart:{single:150000,joint:300000},car:10000,carStart:{single:100000,joint:200000},senior:6000,seniorStart:{single:75000,joint:150000}},
  niit:{joint:250000,mfs:125000,other:200000},addlMedicare:{joint:250000,mfs:125000,other:200000},
  actc:{perChild:1700,floor:2500},
  eic:{investLimit:12200,kids:[{max:664,inRate:.0765,outRate:.0765,single:10860,joint:18140},{max:4427,inRate:.34,outRate:.1598,single:23890,joint:31160},{max:7316,inRate:.40,outRate:.2106,single:23890,joint:31160},{max:8231,inRate:.45,outRate:.2106,single:23890,joint:31160}]},
  // P.L. 119-21 resets the AMT exemption phase-out to $500,000 ($1,000,000 joint) at 50% from 2026.
  amt:{exempt:{single:90100,joint:140200,mfs:70100},phaseStart:{single:500000,joint:1000000,mfs:500000},phaseRate:.5,breakpoint:{normal:244500,mfs:122250}},
  // 2025 poverty guidelines; the 400% cap returns and repayment of excess advance credit is no longer limited.
  fpl:{base:15650,per:5500},ptc:[[1,1.33,.021,.021],[1.33,1.5,.0314,.0419],[1.5,2,.0419,.066],[2,2.5,.066,.0844],[2.5,3,.0844,.0996],[3,4,.0996,.0996]],ptcFloor:1,ptcRepayCap:null,
  limits:{k401:24500,k401CatchUp:8000,ira:7500,iraCatchUp:1100,sep:72000,hsaSelf:4400,hsaFamily:8750,careFsa:7500,qcd:111000,mileage:'72.5 cents',mileageRate:.725,charityNonItemizer:1000},
  // P.L. 119-21: 50% less 1% per $2,000 over $15,000 (not below 35%), then less 1% per $2,000
  // ($4,000 if joint) over $75,000 ($150,000 if joint), not below 20%.
  careRate:(agi,joint)=>{const first=agi<=15000?.5:Math.max(.35,.5-Math.ceil((agi-15000)/2000)*.01);const over=agi-(joint?150000:75000);return pct(over>0?Math.max(.2,first-Math.ceil(over/(joint?4000:2000))*.01):first);},
  careText:'50% minus 1% for each $2,000 of [1040:11] over $15,000 (not below 35%), then minus 1% for each further $2,000 ($4,000 if joint) over $75,000 ($150,000 if joint), not below 20%'
 }
};
const dollars=n=>'$'+n.toLocaleString('en-US');
// Replaces {year}, {prev}, {next} and figure placeholders in labels and hints.
export function yearText(text,year){
 const p=params[year];
 return text.replace(/\{(\w+)\}/g,(m,k)=>({year:String(year),prev:String(year-1),next:String(year+1),prev2:String(year-2),born65:String(year-64),wageBase:dollars(p.ssWageBase),householdMin:dollars(p.householdMin),childCredit:dollars(p.childCredit),actcPer:dollars(p.actc.perChild)})[k]??m);
}
