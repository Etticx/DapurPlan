export type Unit = "g" | "kg" | "ml" | "L" | "pieces";
export const ingredients = [
  {id:"rice", name:"Uncooked rice", kind:"weight"},
  {id:"chicken", name:"Raw boneless chicken", kind:"weight"},
  {id:"cucumber", name:"Cucumber", kind:"weight"},
  {id:"oil", name:"Cooking oil", kind:"liquid"},
  {id:"soy", name:"Soy sauce", kind:"liquid"},
  {id:"noodles", name:"Fresh kuey teow noodles", kind:"weight"},
  {id:"egg", name:"Eggs", kind:"count"},
  {id:"sprouts", name:"Bean sprouts", kind:"weight"},
  {id:"coconut", name:"Coconut milk", kind:"liquid"},
  {id:"sambal", name:"Prepared sambal", kind:"weight"},
  {id:"peanuts", name:"Peanuts", kind:"weight"},
  {id:"anchovies", name:"Dried anchovies", kind:"weight"},
  {id:"coffee", name:"Ground coffee", kind:"weight"},
  {id:"sugar", name:"Sugar", kind:"weight"},
  {id:"water", name:"Water (not stock-tracked)", kind:"liquid"},
  {id:"ice", name:"Ice", kind:"weight"},
  {id:"tea", name:"Tea bags", kind:"count"},
  {id:"lemon", name:"Lemons", kind:"count"},
] as const;
export type IngredientId = typeof ingredients[number]["id"];
export type Recipe = {id:string; name:string; category:"Food"|"Drink"; servings:number; lines:{ingredientId:IngredientId; quantity:number; unit:Unit}[]};
export function unitsFor(id: IngredientId): Unit[] {
  const kind = ingredients.find(i => i.id === id)!.kind;
  return kind === "weight" ? ["g", "kg"] : kind === "liquid" ? ["ml", "L"] : ["pieces"];
}
export function baseQuantity(quantity:number, unit:Unit) { return quantity * (unit === "kg" || unit === "L" ? 1000 : 1); }
export function perServing(quantity:number, unit:Unit, servings:number) {
  return `${Number((baseQuantity(quantity, unit) / servings).toFixed(3))} ${unit === "kg" ? "g" : unit === "L" ? "ml" : unit}`;
}
export const demoRecipes: Recipe[] = [
  {id:"chicken-rice",name:"Chicken rice",category:"Food",servings:20,lines:[{ingredientId:"rice",quantity:2,unit:"kg"},{ingredientId:"chicken",quantity:3,unit:"kg"},{ingredientId:"cucumber",quantity:600,unit:"g"},{ingredientId:"oil",quantity:100,unit:"ml"},{ingredientId:"soy",quantity:100,unit:"ml"}]},
  {id:"kuey-teow",name:"Fried kuey teow with egg",category:"Food",servings:10,lines:[{ingredientId:"noodles",quantity:2,unit:"kg"},{ingredientId:"egg",quantity:10,unit:"pieces"},{ingredientId:"sprouts",quantity:500,unit:"g"},{ingredientId:"oil",quantity:150,unit:"ml"},{ingredientId:"soy",quantity:150,unit:"ml"}]},
  {id:"nasi-lemak",name:"Nasi lemak with egg",category:"Food",servings:20,lines:[{ingredientId:"rice",quantity:2,unit:"kg"},{ingredientId:"coconut",quantity:800,unit:"ml"},{ingredientId:"egg",quantity:20,unit:"pieces"},{ingredientId:"sambal",quantity:600,unit:"g"},{ingredientId:"cucumber",quantity:600,unit:"g"},{ingredientId:"peanuts",quantity:200,unit:"g"},{ingredientId:"anchovies",quantity:200,unit:"g"}]},
  {id:"kopi",name:"Kopi O ais",category:"Drink",servings:10,lines:[{ingredientId:"coffee",quantity:150,unit:"g"},{ingredientId:"sugar",quantity:200,unit:"g"},{ingredientId:"water",quantity:2,unit:"L"},{ingredientId:"ice",quantity:1.5,unit:"kg"}]},
  {id:"tea",name:"Iced lemon tea",category:"Drink",servings:10,lines:[{ingredientId:"tea",quantity:10,unit:"pieces"},{ingredientId:"lemon",quantity:2.5,unit:"pieces"},{ingredientId:"sugar",quantity:150,unit:"g"},{ingredientId:"water",quantity:2,unit:"L"},{ingredientId:"ice",quantity:1.5,unit:"kg"}]},
];
