import { ingredients, unitsFor, baseQuantity, type Recipe, type IngredientId, type Unit } from "./recipes";
export class RecipeInputError extends Error {}
export function validateRecipeUpdate(value:unknown): {servings:number; lines:Recipe["lines"]; version:number} {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RecipeInputError("Enter a valid recipe.");
  const input=value as Record<string,unknown>;
  if (!Number.isSafeInteger(input.servings) || (input.servings as number)<1 || (input.servings as number)>10000) throw new RecipeInputError("Batch servings must be a whole number from 1 to 10,000.");
  if (!Number.isSafeInteger(input.version) || (input.version as number)<1) throw new RecipeInputError("Reload the recipe before saving.");
  if (!Array.isArray(input.lines) || input.lines.length<1 || input.lines.length>ingredients.length) throw new RecipeInputError("Include at least one ingredient, without duplicates.");
  const seen=new Set<string>();
  const lines=input.lines.map((value:unknown)=>{
    if (!value || typeof value!=="object" || Array.isArray(value)) throw new RecipeInputError("Invalid ingredient row.");
    const line=value as Record<string,unknown>;
    if (!ingredients.some(i=>i.id===line.ingredientId)) throw new RecipeInputError("Choose an ingredient from the shared catalogue.");
    const ingredientId=line.ingredientId as IngredientId;
    if (seen.has(ingredientId)) throw new RecipeInputError("Each ingredient can appear only once.");
    seen.add(ingredientId);
    if (!unitsFor(ingredientId).includes(line.unit as Unit)) throw new RecipeInputError("Choose a compatible unit for each ingredient.");
    const unit=line.unit as Unit;
    if (typeof line.quantity!=="number" || !Number.isFinite(line.quantity) || line.quantity<0.001 || baseQuantity(line.quantity,unit)>1e9) throw new RecipeInputError("Ingredient quantities must be positive, finite numbers of at least 0.001.");
    return {ingredientId,unit,quantity:line.quantity};
  });
  return {servings:input.servings as number,version:input.version as number,lines};
}
