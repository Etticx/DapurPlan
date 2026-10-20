import {ingredients,baseQuantity,type IngredientId} from "./recipes";
import type {StoredRecipe} from "./recipe-store";
import type {Inventory} from "./inventory";
import type {ForecastView,SavedForecast} from "./forecast";
export type Prep={menuId:string;servings:number};
export type IngredientNeed={ingredientId:IngredientId;name:string;required:number;available:number;shortage:number;packCount:number|null;packQuantity:number|null;packUnit:string|null;packLabel:string|null;allocations:{batchId:string;quantity:number;expiryDate:string|null}[];warnings:string[]};
export type PlanSnapshot={id:number;forecastId:number;targetDate:string;status:"draft"|"approved";createdAt:string;createdBy:string;basisKey:string;prep:Prep[];needs:IngredientNeed[];sources:{forecast:SavedForecast;recipes:StoredRecipe[];inventory:Inventory};stockReviewed:boolean};
export type PlanningView={forecast:ForecastView;recipes:StoredRecipe[];inventory:Inventory;basisKey:string;saved:PlanSnapshot|null;planStale:boolean};
export function defaultPrep(forecast:SavedForecast):Prep[]{return forecast.predictions.map(p=>({menuId:p.menuId,servings:Math.ceil(p.predictedServings)}));}
export function displayAmount(value:number,id:IngredientId){const kind=ingredients.find(i=>i.id===id)!.kind;const divisor=kind==="count"||value<1000?1:1000;const unit=kind==="count"?(value===1?"piece":"pieces"):kind==="weight"?(divisor===1?"g":"kg"):(divisor===1?"ml":"L");return `${Number((value/divisor).toFixed(3))} ${unit}`;}
export function ingredientNeeds(prep:Prep[],recipes:StoredRecipe[],inventory:Inventory,targetDate:string,countDate:string):IngredientNeed[]{
 const totals=new Map<IngredientId,number>();
 for(const p of prep){const recipe=recipes.find(r=>r.id===p.menuId);if(!recipe)throw new Error("A menu recipe is missing.");for(const l of recipe.lines){if(l.ingredientId!=="water")totals.set(l.ingredientId,(totals.get(l.ingredientId)||0)+baseQuantity(l.quantity,l.unit)/recipe.servings*p.servings);}}
 return ingredients.filter(i=>totals.has(i.id)).map(i=>{
  const raw=totals.get(i.id)!;const required=i.kind==="count"?Math.ceil(raw-1e-9):raw;
  const batches=inventory.batches.filter(b=>b.ingredientId===i.id&&b.quantity>0);
  const usable=batches.filter(b=>!b.expiryDate||b.expiryDate>=targetDate).sort((a,b)=>(a.expiryDate||"9999").localeCompare(b.expiryDate||"9999")||a.countDate.localeCompare(b.countDate)||a.id.localeCompare(b.id));
  const available=usable.reduce((s,b)=>s+baseQuantity(b.quantity,b.unit),0);const shortage=Math.max(0,required-available)<1e-8?0:Math.max(0,required-available);
  const warnings:string[]=[];
  if(!batches.length&&required>0)warnings.push("No positive stock recorded.");
  if(batches.some(b=>b.expiryDate&&b.expiryDate<targetDate))warnings.push("Expired before preparation date: excluded.");
  if(usable.some(b=>!b.expiryDate))warnings.push("Expiry unknown: stock included subject to owner check.");
  if(usable.some(b=>b.countDate<countDate))warnings.push("Stock count is older than today: verify remaining quantity.");
  if(usable.some(b=>b.expiryDate===targetDate))warnings.push("Expires on preparation date: check condition before use.");
  let remaining=required;const allocations=usable.flatMap(b=>{const quantity=Math.min(remaining,baseQuantity(b.quantity,b.unit));remaining-=quantity;return quantity>0?[{batchId:b.id,quantity,expiryDate:b.expiryDate}]:[];});
  const pack=inventory.packs.find(p=>p.ingredientId===i.id);if(!pack&&shortage>0)warnings.push("Purchase pack size not set.");
  return {ingredientId:i.id,name:i.name,required,available,shortage,packCount:pack?Math.ceil(Math.max(0,shortage/baseQuantity(pack.quantity,pack.unit)-1e-9)):null,packQuantity:pack?.quantity??null,packUnit:pack?.unit??null,packLabel:pack?.label??null,allocations,warnings};
 });
}
export class PlanInputError extends Error {}
export function validatePrep(value:unknown,forecast:SavedForecast):Prep[]{
 if(!Array.isArray(value)||value.length!==forecast.predictions.length)throw new PlanInputError("Enter preparation quantities for all five menus.");
 const seen=new Set<string>();return value.map(v=>{if(!v||typeof v!=="object"||!forecast.predictions.some(p=>p.menuId===v.menuId)||seen.has(v.menuId)||!Number.isSafeInteger(v.servings)||v.servings<0||v.servings>1000000)throw new PlanInputError("Use unique menus and whole preparation quantities from 0 to 1,000,000.");seen.add(v.menuId);return {menuId:v.menuId,servings:v.servings};});
}

export function purchaseText(n:IngredientNeed){
 if(n.shortage===0)return "Covered";
 if(n.packCount===null||n.packQuantity===null||n.packUnit===null)return "Set pack size in Inventory";
 if(n.packLabel==="kg purchase")return `Buy ${displayAmount(n.packCount*baseQuantity(n.packQuantity,n.packUnit as import("./recipes").Unit),n.ingredientId)} by weight`;
 if(n.packUnit==="pieces"&&n.packQuantity===1)return `${n.packCount} ${n.packCount===1?"piece":"pieces"}`;
 const label=n.packLabel||"pack";
 return `${n.packCount} ${label}${n.packCount===1?"":"s"} · ${n.packQuantity} ${n.packUnit} each`;
}
