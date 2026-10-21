import {ingredients,baseQuantity,type Recipe} from "./recipes";
import type {Pack} from "./inventory";

export type IngredientCostSnapshot={
 ingredientId:string;
 name:string;
 quantity:number;
 unit:Recipe["lines"][number]["unit"];
 quantityPerServing:number;
 batchCostCents:number|null;
};
export type RecipeCostSnapshot={
 menuId:string;
 recipeVersion:number;
 servings:number;
 batchCostCents:number|null;
 perServingCostCents:number|null;
 ingredients:IngredientCostSnapshot[];
};

export function costRecipe(recipe:Recipe&{version:number},packs:Pack[]):RecipeCostSnapshot{
 const ingredientCosts=recipe.lines.map(line=>{
  const info=ingredients.find(item=>item.id===line.ingredientId)!;
  const pack=packs.find(item=>item.ingredientId===line.ingredientId);
  const batchCostCents=pack?.costCents==null?null:Math.round(pack.costCents*baseQuantity(line.quantity,line.unit)/baseQuantity(pack.quantity,pack.unit));
  return {ingredientId:line.ingredientId,name:info.name,quantity:line.quantity,unit:line.unit,quantityPerServing:line.quantity/recipe.servings,batchCostCents};
 });
 const batchCostCents=ingredientCosts.every(line=>line.batchCostCents!==null)?ingredientCosts.reduce((sum,line)=>sum+(line.batchCostCents??0),0):null;
 return {menuId:recipe.id,recipeVersion:recipe.version,servings:recipe.servings,batchCostCents,perServingCostCents:batchCostCents===null?null:Math.round(batchCostCents/recipe.servings),ingredients:ingredientCosts};
}
