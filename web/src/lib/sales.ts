import {demoRecipes} from "./recipes";
import {validDate,malaysiaDate} from "./inventory";
import type {RecipeCostSnapshot} from "./costing";
export const salesMenus=demoRecipes.map(({id,name,category})=>({id,name,category}));
export type SaleLine={menuId:string;quantity:number|null;soldOut:boolean;unitPriceCents:number|null;ingredientCostPerServingCents:number|null;costSnapshot:RecipeCostSnapshot|null};
export type SalesDay={provenance?:{sourceFile:string;sourceDate:string;sourceRows:string}|null;date:string;version:number;lines:SaleLine[];updatedBy:string|null;updatedAt:string|null};
export type DailyExpense={id:string;category:string;amountCents:number;note:string};
export type SalesTrendPeriod="daily"|"weekly"|"monthly";
export type FinancialSummary={date:string;revenueCents:number|null;ingredientCostCents:number|null;expensesCents:number;grossProfitCents:number|null;netProfitCents:number|null;salesDays:number};
export type SalesSummary=FinancialSummary&{sourceDate?:string|null;version:number;entered:number;total:number;updatedAt:string};
export type SalesData={day:SalesDay;previousDay:SalesDay;recent:SalesSummary[];menuPrices:Record<string,number|null>;menuCosts:Record<string,RecipeCostSnapshot>;expenses:DailyExpense[];expenseVersion:number;trend:FinancialSummary[];trendPeriod:SalesTrendPeriod};
export class SalesInputError extends Error {}
export function salesDate(value:unknown){if(!validDate(value)||value>malaysiaDate())throw new SalesInputError("Choose today or an earlier valid date.");return value;}
export function emptySalesDay(date:string):SalesDay{return {date,version:0,lines:salesMenus.map(m=>({menuId:m.id,quantity:null,soldOut:false,unitPriceCents:null,ingredientCostPerServingCents:null,costSnapshot:null})),updatedAt:null,updatedBy:null};}
export function validateSales(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))throw new SalesInputError("Enter valid daily sales.");
 const v=value as Record<string,unknown>;const date=salesDate(v.date);
 if(!Number.isSafeInteger(v.version)||(v.version as number)<0)throw new SalesInputError("Reload this sales date before saving.");
 if(!Array.isArray(v.lines)||v.lines.length!==salesMenus.length)throw new SalesInputError("Include each of the five menu items once.");
 const seen=new Set<string>();
 const lines:SaleLine[]=v.lines.map((item:unknown)=>{
  if(!item||typeof item!=="object"||Array.isArray(item))throw new SalesInputError("Invalid sales row.");
  const line=item as Record<string,unknown>;
  if(typeof line.menuId!=="string"||!salesMenus.some(m=>m.id===line.menuId)||seen.has(line.menuId))throw new SalesInputError("Include each fixed menu item once.");
  seen.add(line.menuId);
  if(line.quantity!==null&&(!Number.isSafeInteger(line.quantity)||(line.quantity as number)<0||(line.quantity as number)>1000000))throw new SalesInputError("Sales must be whole numbers from 0 to 1,000,000, or blank if not entered.");
  if(typeof line.soldOut!=="boolean"||(line.quantity===null&&line.soldOut))throw new SalesInputError("Enter a sales quantity before marking an item sold out.");
  return {menuId:line.menuId,quantity:line.quantity as number|null,soldOut:line.soldOut,unitPriceCents:null,ingredientCostPerServingCents:null,costSnapshot:null};
 });
 if(lines.every(l=>l.quantity===null))throw new SalesInputError("Enter sales for at least one menu item. Use 0 for confirmed zero sales.");
 return {date,version:v.version as number,lines};
}

export class ExpenseInputError extends Error {}
export function validateExpenses(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))throw new ExpenseInputError("Enter valid daily expenses.");
 const input=value as Record<string,unknown>;
 const date=salesDate(input.date);
 if(!Number.isSafeInteger(input.version)||(input.version as number)<0)throw new ExpenseInputError("Reload expenses before saving.");
 if(!Array.isArray(input.expenses)||input.expenses.length>100)throw new ExpenseInputError("Enter up to 100 expenses for the day.");
 const expenses:Omit<DailyExpense,"id">[]=input.expenses.map((item:unknown)=>{
  if(!item||typeof item!=="object"||Array.isArray(item))throw new ExpenseInputError("Invalid expense entry.");
  const expense=item as Record<string,unknown>;
  if(typeof expense.category!=="string"||expense.category.trim().length<2||expense.category.trim().length>40)throw new ExpenseInputError("Enter an expense category from 2 to 40 characters.");
  if(!Number.isSafeInteger(expense.amountCents)||(expense.amountCents as number)<1||(expense.amountCents as number)>100000000)throw new ExpenseInputError("Expense amounts must be between RM 0.01 and RM 1,000,000.00.");
  if(typeof expense.note!=="string"||expense.note.trim().length>120)throw new ExpenseInputError("Expense notes must be no longer than 120 characters.");
  return {category:expense.category.trim(),amountCents:expense.amountCents as number,note:expense.note.trim()};
 });
 return {date,version:input.version as number,expenses};
}
