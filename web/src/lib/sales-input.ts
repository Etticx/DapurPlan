export const MAX_SALES_SERVINGS=1_000_000;
export const MAX_EXPENSE_CENTS=100_000_000;

export function parseServingsInput(value:string):number|null|undefined{
 if(value==="")return null;
 if(!/^\d{1,7}$/.test(value))return undefined;
 const count=Number(value);
 return Number.isSafeInteger(count)&&count<=MAX_SALES_SERVINGS?count:undefined;
}

export function parseExpenseAmount(value:string):number|null{
 if(!/^\d+(?:[.,]\d{0,2})?$/.test(value))return null;
 const amount=Number(value.replace(",","."));
 const cents=Math.round(amount*100);
 return Number.isFinite(amount)&&cents>=1&&cents<=MAX_EXPENSE_CENTS?cents:null;
}
