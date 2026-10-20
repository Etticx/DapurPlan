import {demoRecipes} from "./recipes";
import {validDate,malaysiaDate} from "./inventory";
export const salesMenus=demoRecipes.map(({id,name,category})=>({id,name,category}));
export type SaleLine={menuId:string;quantity:number|null;soldOut:boolean};
export type SalesDay={provenance?:{sourceFile:string;sourceDate:string;sourceRows:string}|null;date:string;version:number;lines:SaleLine[];updatedBy:string|null;updatedAt:string|null};
export type SalesSummary={sourceDate?:string|null;date:string;version:number;entered:number;total:number;updatedAt:string};
export type SalesData={day:SalesDay;recent:SalesSummary[]};
export class SalesInputError extends Error {}
export function salesDate(value:unknown){if(!validDate(value)||value>malaysiaDate())throw new SalesInputError("Choose today or an earlier valid date.");return value;}
export function emptySalesDay(date:string):SalesDay{return {date,version:0,lines:salesMenus.map(m=>({menuId:m.id,quantity:null,soldOut:false})),updatedAt:null,updatedBy:null};}
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
  return {menuId:line.menuId,quantity:line.quantity as number|null,soldOut:line.soldOut};
 });
 if(lines.every(l=>l.quantity===null))throw new SalesInputError("Enter sales for at least one menu item. Use 0 for confirmed zero sales.");
 return {date,version:v.version as number,lines};
}
