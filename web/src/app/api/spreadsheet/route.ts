import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {getInventoryStore} from "@/lib/inventory-db";
import {getPlanStore} from "@/lib/plan-db";
import {getRecipeStore} from "@/lib/db";
import {getSalesStore} from "@/lib/sales-db";
import {ingredients,unitsFor,type IngredientId,type Unit} from "@/lib/recipes";
import {InventoryInputError,malaysiaDate} from "@/lib/inventory";
import {salesMenus,salesDate} from "@/lib/sales";
import {SalesConflictError,ExpenseConflictError} from "@/lib/sales-store";
import {importSalesRows} from "@/lib/sales-import";
import {InventoryConflictError,InventoryPermissionError} from "@/lib/inventory-store";
import {RecipeConflictError,RecipeNotFoundError} from "@/lib/recipe-store";
import {RecipeInputError} from "@/lib/recipe-validation";
import {CsvInputError,CsvPayloadTooLargeError,csvBoolean,csvDecimal,csvInteger,csvMoneyCents,parseCsv,readBoundedBody,requireCsvColumns,stringifyCsv} from "@/lib/spreadsheet";

export const runtime="nodejs";
const exportTypes=["sales","expenses","inventory","recipes","ingredient-prices","planning"] as const;
type ExportType=typeof exportTypes[number];
const headers:Record<ExportType,string[]>={
 sales:["date","version","menu_id","menu_name","servings","sold_out"],
 expenses:["date","version","operation","expense_id","category","amount_rm","note"],
 inventory:["batch_id","version","ingredient_id","ingredient_name","quantity","unit","count_date","expiry_date","pack_quantity","pack_unit","pack_label","pack_cost_cents"],
 recipes:["menu_id","menu_name","category","version","batch_servings","menu_price_rm","ingredient_id","ingredient_name","ingredient_quantity","ingredient_unit"],
 "ingredient-prices":["ingredient_id","ingredient_name","version","price_unit","price_quantity","cost_rm"],
 planning:["record_type","target_date","status","menu_id","menu_name","predicted_servings","planned_servings","ingredient_id","ingredient_name","required_quantity","available_quantity","shortage_quantity","unit"],
};
function csvResponse(type:ExportType,rows:Record<string,string|number|boolean|null|undefined>[]){
 return new Response(stringifyCsv(headers[type],rows),{headers:{
  "Content-Type":"text/csv; charset=utf-8",
  "Content-Disposition":`attachment; filename="dapurplan-${type}.csv"`,
  "Cache-Control":"no-store",
 }});
}
function rowsFor(type:ExportType){
 const sales=getSalesStore();const inventory=getInventoryStore();
 if(type==="sales"){
  const days=sales.spreadsheetSales();
  const today=malaysiaDate();
  if(!days.some(day=>day.date===today))days.push(sales.day(today));
  const menuNames=new Map(salesMenus.map(menu=>[menu.id,menu.name]));
  return days.flatMap(day=>day.lines.map(line=>({
   date:day.date,version:day.version,menu_id:line.menuId,menu_name:menuNames.get(line.menuId),
   servings:line.quantity,sold_out:line.soldOut,
  })));
 }
 if(type==="expenses"){
  const rows=sales.spreadsheetExpenses().map(expense=>({
   date:expense.date,version:expense.version,operation:"upsert",expense_id:expense.id,
   category:expense.category,amount_rm:(expense.amountCents/100).toFixed(2),note:expense.note,
  }));
  const today=malaysiaDate();
  if(!rows.some(row=>row.date===today)){
   const state=sales.expenseState(today);
   rows.push({date:today,version:state.expenseVersion,operation:"upsert",expense_id:"",category:"",amount_rm:"",note:""});
  }
  return rows;
 }
 if(type==="inventory"){
  const stock=inventory.list();const names=new Map(ingredients.map(ingredient=>[ingredient.id,ingredient.name]));
  const rows:Record<string,string|number|null|undefined>[]=stock.batches.map(batch=>{
   const pack=stock.packs.find(item=>item.ingredientId===batch.ingredientId);
   return {
    batch_id:batch.id,version:batch.version,ingredient_id:batch.ingredientId,ingredient_name:names.get(batch.ingredientId),
    quantity:batch.quantity,unit:batch.unit,count_date:batch.countDate,expiry_date:batch.expiryDate,
    pack_quantity:pack?.quantity,pack_unit:pack?.unit,pack_label:pack?.label,pack_cost_cents:pack?.costCents,
   };
  });
  for(const ingredient of ingredients.filter(item=>item.id!=="water")){
   const pack=stock.packs.find(item=>item.ingredientId===ingredient.id);
   rows.push({
    batch_id:"",version:"",ingredient_id:ingredient.id,ingredient_name:ingredient.name,quantity:"",unit:unitsFor(ingredient.id)[0],
    count_date:malaysiaDate(),expiry_date:"",pack_quantity:pack?.quantity??1,pack_unit:pack?.unit??unitsFor(ingredient.id)[0],
    pack_label:pack?.label??"pack",pack_cost_cents:pack?.costCents,
   });
  }
  return rows;
 }
 if(type==="recipes"){
  const recipes=getRecipeStore().list();
  const names=new Map(ingredients.map(ingredient=>[ingredient.id,ingredient.name]));
  return recipes.flatMap(recipe=>recipe.lines.map(line=>({
   menu_id:recipe.id,menu_name:recipe.name,category:recipe.category,version:recipe.version,batch_servings:recipe.servings,
   menu_price_rm:recipe.priceCents===null?"":(recipe.priceCents/100).toFixed(2),
   ingredient_id:line.ingredientId,ingredient_name:names.get(line.ingredientId),
   ingredient_quantity:line.quantity,ingredient_unit:line.unit,
  })));
 }
 if(type==="ingredient-prices"){
  const stock=inventory.list();const prices=new Map((stock.prices??[]).map(price=>[price.ingredientId,price]));
  return ingredients.map(ingredient=>{
   const price=prices.get(ingredient.id);
   return {ingredient_id:ingredient.id,ingredient_name:ingredient.name,version:price?.version??0,
    price_unit:price?.unit??(ingredient.kind==="weight"?"kg":ingredient.kind==="liquid"?"L":"pieces"),
    price_quantity:price?.quantity??(ingredient.id==="egg"?30:ingredient.id==="tea"?100:1),
    cost_rm:price?.costCents==null?"":(price.costCents/100).toFixed(2)};
  });
 }
 const plan=getPlanStore().view();const saved=plan.saved;
 if(!saved)return [];
 const planRows=saved.prep.map(prep=>{
  const prediction=saved.sources.forecast.predictions.find(item=>item.menuId===prep.menuId);
  const recipe=saved.sources.recipes.find(item=>item.id===prep.menuId);
  return {record_type:"menu",target_date:saved.targetDate,status:saved.status,menu_id:prep.menuId,menu_name:recipe?.name,
   predicted_servings:prediction?.predictedServings,planned_servings:prep.servings};
 });
 const needs=saved.needs.map(need=>({
  record_type:"ingredient",target_date:saved.targetDate,status:saved.status,ingredient_id:need.ingredientId,ingredient_name:need.name,
  required_quantity:need.required,available_quantity:need.available,shortage_quantity:need.shortage,unit:unitsFor(need.ingredientId)[0],
 }));
 return [...planRows,...needs];
}

function validateOrigin(request:Request){
 const origin=request.headers.get("origin");
 if(origin&&new URL(origin).host!==request.headers.get("host"))throw new CsvInputError("Request not allowed.");
}
export async function GET(request:Request){
 if(!await getSession())return NextResponse.json({error:"Sign in first."},{status:401});
 const type=new URL(request.url).searchParams.get("type") as ExportType|null;
 if(!type||!exportTypes.includes(type))return NextResponse.json({error:"Choose a supported CSV export."},{status:400});
 try{return csvResponse(type,rowsFor(type));}
 catch{return NextResponse.json({error:"Could not export this data. Please try again."},{status:503});}
}

export async function POST(request:Request){
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sign in first."},{status:401});
 try{validateOrigin(request);}catch{return NextResponse.json({error:"Request not allowed."},{status:403});}
 const contentLength=request.headers.get("content-length");
 if(contentLength!==null&&(!/^\d+$/.test(contentLength)||Number(contentLength)>1_100_000))return NextResponse.json({error:"CSV files may not exceed 1 MB."},{status:413});
 let type:ExportType;let source:string;
 try{
  const body=await readBoundedBody(request.body,1_100_000);
  const requestHeaders=new Headers(request.headers);
  requestHeaders.delete("content-length");
  requestHeaders.delete("transfer-encoding");
  const boundedBody=new ArrayBuffer(body.byteLength);
  new Uint8Array(boundedBody).set(body);
  const form=await new Request(request.url,{method:"POST",headers:requestHeaders,body:boundedBody}).formData();
  const rawType=form.get("type");const file=form.get("file");
  if(typeof rawType!=="string"||!exportTypes.includes(rawType as ExportType)||!(file instanceof File))throw new CsvInputError("Choose a supported data type and CSV file.");
  type=rawType as ExportType;
  if(type==="planning")throw new CsvInputError("Planning is generated from sales, recipes, and stock. It can be exported but not imported.");
  if((type==="recipes"||type==="ingredient-prices")&&session.role!=="owner")return NextResponse.json({error:"Only the owner can import recipe or ingredient price changes."},{status:403});
  if(file.size>1_000_000)throw new CsvInputError("CSV files may not exceed 1 MB.");
  source=new TextDecoder("utf-8",{fatal:true}).decode(await file.arrayBuffer());
 }catch(error){
  const status=error instanceof CsvPayloadTooLargeError?413:400;
  return NextResponse.json({error:error instanceof CsvInputError?error.message:"Upload a valid UTF-8 CSV file."},{status});
 }
 let parsed;
 try{parsed=parseCsv(source);requireCsvColumns(parsed.headers,headers[type]);}
 catch(error){return NextResponse.json({error:error instanceof CsvInputError?error.message:"Could not read the CSV."},{status:400});}

 const errors:string[]=[];let imported=0;
 const fail=(row:number,error:unknown)=>errors.push(`Row ${row}: ${error instanceof Error?error.message:"Could not import this row."}`);
 try{
  const sales=getSalesStore();
  if(type==="sales"){
   const result=importSalesRows(parsed.rows,session.username,sales);
   imported+=result.imported;errors.push(...result.errors);
  }else if(type==="expenses"){
   const groups=new Map<string,{version:number;rows:{row:number;data:typeof parsed.rows[number]}[]}>();
   parsed.rows.forEach((data,index)=>{
    const row=index+2;
    try{
     const date=salesDate(data.date);const version=csvInteger(data.version,`Row ${row} version`,{max:1_000_000});
     const current=groups.get(date);
     if(current&&current.version!==version)throw new CsvInputError("All rows for an expense date must use the same version.");
     if(current)current.rows.push({row,data});else groups.set(date,{version:version!,rows:[{row,data}]});
    }catch(error){fail(row,error);}
   });
   for(const [date,group] of groups){
    try{
     const clears=group.rows.filter(item=>item.data.operation==="clear-date");
     if(clears.length){
      if(clears.length!==group.rows.length||group.rows.length!==1)throw new CsvInputError("Use one clear-date row by itself for a date.");
      sales.saveExpenses({date,version:group.version,expenses:[]},session.username);imported++;
     }else{
      const expenses=group.rows.flatMap(({data,row})=>{
       if(data.operation!=="upsert")throw new CsvInputError(`Row ${row} operation must be upsert or clear-date.`);
       if(data.category===""&&data.amount_rm==="")return [];
       const amountCents=csvMoneyCents(data.amount_rm,`Row ${row} amount_rm`);
       if(!data.category.trim()||amountCents===null||amountCents<1)throw new CsvInputError(`Row ${row} needs a category and an amount of at least RM 0.01.`);
       return [{category:data.category,amountCents,note:data.note}];
      });
      if(expenses.length===0)continue;
      const current=sales.expenseState(date);
      const unchanged=current.expenseVersion===group.version&&expenses.length===current.expenses.length&&expenses.every((expense,index)=>{
       const existing=current.expenses[index];
       return existing?.category===expense.category&&existing.amountCents===expense.amountCents&&existing.note===expense.note;
      });
      if(unchanged){imported+=group.rows.length;continue;}
      sales.saveExpenses({date,version:group.version,expenses},session.username);imported+=group.rows.length;
     }
    }catch(error){for(const item of group.rows)fail(item.row,error);}
   }
  }else if(type==="inventory"){
   const inventory=getInventoryStore();
   for(const [index,data] of parsed.rows.entries()){
    const row=index+2;
    try{
     if(!data.batch_id&&data.quantity==="")continue;
     if(data.quantity==="")throw new CsvInputError(`Row ${row} needs a quantity for an existing batch.`);
     const id=data.batch_id||undefined;
     const version=id?csvInteger(data.version,`Row ${row} version`,{min:1,max:1_000_000}):undefined;
     const ingredientId=data.ingredient_id as IngredientId;
     const quantity=csvDecimal(data.quantity,`Row ${row} quantity`,{max:1_000_000_000});
     const packQuantity=csvDecimal(data.pack_quantity,`Row ${row} pack_quantity`,{min:0.001,max:1_000_000_000});
     const packCostCents=data.pack_cost_cents===""?undefined:csvInteger(data.pack_cost_cents,`Row ${row} pack_cost_cents`,{max:100_000_000});
     const input={id,version,ingredientId,quantity,unit:data.unit as Unit,countDate:data.count_date,expiryDate:data.expiry_date||null,
      packQuantity,packUnit:data.pack_unit as Unit,packLabel:data.pack_label,packCostCents};
     if(id){
      const stock=inventory.list();const current=stock.batches.find(batch=>batch.id===id);
      const pack=stock.packs.find(item=>item.ingredientId===ingredientId);
      const unchanged=!!current&&!!pack&&current.version===version&&current.ingredientId===ingredientId&&current.quantity===quantity&&current.unit===input.unit&&current.countDate===input.countDate&&current.expiryDate===input.expiryDate&&
       pack.quantity===packQuantity&&pack.unit===input.packUnit&&pack.label===input.packLabel&&(packCostCents===undefined||(pack.costCents??null)===packCostCents);
      if(unchanged){imported++;continue;}
     }
     inventory.save(input,session.username);
     imported++;
    }catch(error){fail(row,error);}
   }
  }else if(type==="ingredient-prices"){
   const inventory=getInventoryStore();
   for(const [index,data] of parsed.rows.entries()){
    const row=index+2;
    try{
     const costCents=csvMoneyCents(data.cost_rm,`Row ${row} cost_rm`,{blank:true});
     const quantity=csvDecimal(data.price_quantity,`Row ${row} price_quantity`,{min:0.001});
     const version=csvInteger(data.version,`Row ${row} version`,{max:1_000_000});
     const current=getInventoryStore().list().prices?.find(price=>price.ingredientId===data.ingredient_id);
     if(current&&current.version===version&&current.unit===data.price_unit&&current.quantity===quantity&&current.costCents===costCents){imported++;continue;}
     if(!current&&version===0&&costCents===null){imported++;continue;}
     inventory.savePrice({ingredientId:data.ingredient_id,unit:data.price_unit,quantity,costCents,version},session.username,session.role);
     imported++;
    }catch(error){fail(row,error);}
   }
  }else if(type==="recipes"){
   const recipes=getRecipeStore();
   const groups=new Map<string,{version:number;servings:number;priceCents:number|null;rows:{row:number;data:typeof parsed.rows[number]}[]}>();
   parsed.rows.forEach((data,index)=>{
    const row=index+2;
    try{
     const version=csvInteger(data.version,`Row ${row} version`,{min:1,max:1_000_000});
     const servings=csvInteger(data.batch_servings,`Row ${row} batch_servings`,{min:1,max:10_000});
     const priceCents=csvMoneyCents(data.menu_price_rm,`Row ${row} menu_price_rm`,{blank:true});
     const current=groups.get(data.menu_id);
     if(current&&(current.version!==version||current.servings!==servings||current.priceCents!==priceCents))throw new CsvInputError("Recipe metadata must match across its ingredient rows.");
     if(current)current.rows.push({row,data});else groups.set(data.menu_id,{version:version!,servings:servings!,priceCents,rows:[{row,data}]});
    }catch(error){fail(row,error);}
   });
   for(const [id,group] of groups){
    try{
     const lines=group.rows.map(({data,row})=>({
      ingredientId:data.ingredient_id,quantity:csvDecimal(data.ingredient_quantity,`Row ${row} ingredient_quantity`,{min:0.001,max:1_000_000_000})!,
      unit:data.ingredient_unit as Unit,
     }));
     const current=recipes.list().find(recipe=>recipe.id===id);
     const unchanged=current?.version===group.version&&current.servings===group.servings&&current.priceCents===group.priceCents&&current.lines.length===lines.length&&
      lines.every(line=>current.lines.some(existing=>existing.ingredientId===line.ingredientId&&existing.quantity===line.quantity&&existing.unit===line.unit));
     if(unchanged){imported+=group.rows.length;continue;}
     recipes.update(id,{version:group.version,servings:group.servings,priceCents:group.priceCents,lines},session.username);
     imported+=group.rows.length;
    }catch(error){for(const item of group.rows)fail(item.row,error);}
   }
  }
 }catch(error){
  const status=error instanceof InventoryPermissionError?403:
   error instanceof SalesConflictError||error instanceof ExpenseConflictError||error instanceof InventoryConflictError||error instanceof RecipeConflictError?409:
   error instanceof InventoryInputError||error instanceof RecipeInputError||error instanceof RecipeNotFoundError?400:503;
  if(status!==503)return NextResponse.json({imported,errors:[...errors,error instanceof Error?error.message:"Import could not be completed."]},{status});
  return NextResponse.json({imported,errors:[...errors,"Import stopped because the database could not complete the request. Review saved rows before retrying."]},{status:503});
 }
 return NextResponse.json({imported,errors},{status:errors.length?207:200});
}
