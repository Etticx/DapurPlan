export type SaleFinancialInput = {
 menuId:string;
 quantity:number|null;
 unitPriceCents:number|null;
 ingredientCostPerServingCents:number|null;
};

export type SaleLineFinancials = {
 menuId:string;
 revenueCents:number|null;
 ingredientCostCents:number|null;
 contributionCents:number|null;
 contributionMarginPercent:number|null;
};

export type SaleFinancialTotals = {
 revenueCents:number|null;
 ingredientCostCents:number|null;
};

export function addCents(left:number,right:number){
 const total=left+right;
 return Number.isSafeInteger(total)?total:null;
}

function subtractCents(left:number,right:number){
 const total=left-right;
 return Number.isSafeInteger(total)?total:null;
}

function multiplyCents(left:number,right:number){
 const total=left*right;
 return Number.isSafeInteger(total)?total:null;
}

export function calculateSaleLineFinancials(line:SaleFinancialInput):SaleLineFinancials{
 if(line.quantity===null)return {menuId:line.menuId,revenueCents:null,ingredientCostCents:null,contributionCents:null,contributionMarginPercent:null};
 const revenueCents=line.quantity===0?0:line.unitPriceCents===null?null:multiplyCents(line.quantity,line.unitPriceCents);
 const ingredientCostCents=line.quantity===0?0:line.ingredientCostPerServingCents===null?null:multiplyCents(line.quantity,line.ingredientCostPerServingCents);
 const contributionCents=revenueCents===null||ingredientCostCents===null?null:subtractCents(revenueCents,ingredientCostCents);
 return {menuId:line.menuId,revenueCents,ingredientCostCents,contributionCents,contributionMarginPercent:contributionCents===null||revenueCents===null||revenueCents===0?null:contributionCents/revenueCents*100};
}

export function calculateSaleFinancialTotals(lines:SaleFinancialInput[]):SaleFinancialTotals{
 const entered=lines.filter(line=>line.quantity!==null);
 if(entered.length===0)return {revenueCents:null,ingredientCostCents:null};
 const calculations=entered.map(calculateSaleLineFinancials);
 const sum=(key:"revenueCents"|"ingredientCostCents")=>{
  let total=0;
  for(const line of calculations){const amount=line[key];if(amount===null)return null;const next=addCents(total,amount);if(next===null)return null;total=next;}
  return total;
 };
 return {
  revenueCents:sum("revenueCents"),
  ingredientCostCents:sum("ingredientCostCents"),
 };
}

export function profitMarginPercent(profitCents:number|null,revenueCents:number|null){
 return profitCents===null||revenueCents===null||revenueCents===0?null:profitCents/revenueCents*100;
}

export function calculateProfitTotals(input:{
 date:string;
 revenueCents:number|null;
 ingredientCostCents:number|null;
 expensesCents:number;
 expensesRecorded:boolean;
 salesDays:number;
})

{
 const grossProfitCents=input.revenueCents===null||input.ingredientCostCents===null?null:subtractCents(input.revenueCents,input.ingredientCostCents);
 const netProfitCents=grossProfitCents===null||!input.expensesRecorded?null:subtractCents(grossProfitCents,input.expensesCents);
 return {
  date:input.date,
  revenueCents:input.revenueCents,
  ingredientCostCents:input.ingredientCostCents,
  expensesCents:input.expensesCents,
  expensesRecorded:input.expensesRecorded,
  grossProfitCents,
  netProfitCents,
  grossProfitMarginPercent:profitMarginPercent(grossProfitCents,input.revenueCents),
  netProfitMarginPercent:profitMarginPercent(netProfitCents,input.revenueCents),
  salesDays:input.salesDays,
 };
}
