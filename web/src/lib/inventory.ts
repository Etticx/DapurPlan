import {ingredients,unitsFor,baseQuantity,type IngredientId,type Unit} from "./recipes";
export type Batch={id:string;ingredientId:IngredientId;quantity:number;unit:Unit;countDate:string;expiryDate:string|null;version:number;isDemo:boolean;updatedBy:string;updatedAt:string};
export type Pack={ingredientId:IngredientId;quantity:number;unit:Unit;label:string};
export type Inventory={batches:Batch[];packs:Pack[]};
export function malaysiaDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuala_Lumpur",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export function addDays(date:string,days:number){const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function validDate(value:unknown):value is string {return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;}
export class InventoryInputError extends Error {}
export function validateBatch(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))throw new InventoryInputError("Enter valid stock details.");
 const v=value as Record<string,unknown>;
 if(!ingredients.some(i=>i.id===v.ingredientId&&i.id!=="water"))throw new InventoryInputError("Choose a stock-tracked ingredient.");
 const ingredientId=v.ingredientId as IngredientId;
 if(!unitsFor(ingredientId).includes(v.unit as Unit))throw new InventoryInputError("Choose a compatible stock unit.");
 const unit=v.unit as Unit;
 if(typeof v.quantity!=="number"||!Number.isFinite(v.quantity)||v.quantity<0||baseQuantity(v.quantity,unit)>1e9||(unit==="pieces"&&!Number.isInteger(v.quantity)))throw new InventoryInputError("Enter a non-negative stock quantity; pieces must be whole numbers.");
 if(!validDate(v.countDate)||v.countDate>malaysiaDate())throw new InventoryInputError("Closing count date must be today or earlier.");
 const expiryDate=v.expiryDate===""||v.expiryDate===null?null:v.expiryDate;
 if(expiryDate!==null&&!validDate(expiryDate))throw new InventoryInputError("Enter a valid expiry date or leave it blank.");
 if(v.id!==undefined&&(typeof v.id!=="string"||!v.id||!Number.isSafeInteger(v.version)||(v.version as number)<1))throw new InventoryInputError("Reload the batch before editing.");
 if(typeof v.packQuantity!=="number"||!Number.isFinite(v.packQuantity)||v.packQuantity<=0||v.packQuantity>1e9||!unitsFor(ingredientId).includes(v.packUnit as Unit)||(v.packUnit==="pieces"&&!Number.isInteger(v.packQuantity)))throw new InventoryInputError("Enter a positive purchase pack size with a compatible unit.");
 if(typeof v.packLabel!=="string"||!v.packLabel.trim()||v.packLabel.trim().length>30)throw new InventoryInputError("Enter a pack name of up to 30 characters.");
 return {id:v.id as string|undefined,version:v.version as number|undefined,ingredientId,quantity:v.quantity,unit,countDate:v.countDate,expiryDate,packQuantity:v.packQuantity,packUnit:v.packUnit as Unit,packLabel:v.packLabel.trim()};
}
// Closing stock examples, not opening purchases or a food-storage recommendation.
export const demoStock:[IngredientId,number,Unit,number,Unit,string][]=[
 ["rice",5,"kg",5,"kg","bag"],["noodles",3,"kg",1,"kg","pack"],["chicken",4,"kg",1,"kg","pack"],["egg",40,"pieces",30,"pieces","tray"],
 ["cucumber",2,"kg",1,"kg","kg purchase"],["sprouts",0.8,"kg",1,"kg","pack"],["sambal",1,"kg",1,"kg","pack"],["peanuts",0.5,"kg",1,"kg","pack"],["anchovies",0.5,"kg",0.5,"kg","pack"],
 ["oil",2,"L",5,"L","bottle"],["soy",1,"L",1,"L","bottle"],["coconut",1,"L",1,"L","carton"],["coffee",0.5,"kg",0.5,"kg","pack"],["sugar",0.3,"kg",1,"kg","bag"],["tea",30,"pieces",100,"pieces","box"],["lemon",8,"pieces",1,"pieces","piece"],["ice",5,"kg",5,"kg","bag"]];
