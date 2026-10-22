import demoSales from "./demo-sales-data.json";
import Database from "better-sqlite3";
import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {openRecipeStore} from "./recipe-store";
import {openInventoryStore} from "./inventory-store";
import {costRecipe,type RecipeCostSnapshot} from "./costing";
import {SalesInputError,validateSales,validateExpenses,salesDate,emptySalesDay,type SalesDay,type SalesSummary,type SalesData,type SaleLine,type DailyExpense,type FinancialSummary,type SalesTrendPeriod} from "./sales";
import {addDays} from "./inventory";
export class SalesConflictError extends Error {}
export class ExpenseConflictError extends Error {}
export function openSalesStore(filename=process.env.DAPURPLAN_DB_PATH||resolve(process.cwd(),"data/dapurplan.sqlite")){
 const inventory=openInventoryStore(filename);const recipes=openRecipeStore(filename);
 const db=new Database(filename);db.pragma("foreign_keys = ON");db.pragma("busy_timeout = 5000");
 db.transaction(()=>{db.exec(`
 CREATE TABLE IF NOT EXISTS sales_days(date TEXT PRIMARY KEY,version INTEGER NOT NULL CHECK(version>0),updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sales_lines(date TEXT NOT NULL REFERENCES sales_days(date),menu_id TEXT NOT NULL REFERENCES menus(id),quantity INTEGER CHECK(quantity IS NULL OR (quantity>=0 AND quantity<=1000000)),sold_out INTEGER NOT NULL CHECK(sold_out IN (0,1)),PRIMARY KEY(date,menu_id));
 CREATE TABLE IF NOT EXISTS sales_history(date TEXT NOT NULL REFERENCES sales_days(date),version INTEGER NOT NULL,changed_by TEXT NOT NULL,changed_at TEXT NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(date,version));
 CREATE TABLE IF NOT EXISTS sales_provenance(date TEXT PRIMARY KEY REFERENCES sales_days(date),source_file TEXT NOT NULL,source_date TEXT NOT NULL,source_rows TEXT NOT NULL,source_sha256 TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS daily_expense_days(date TEXT PRIMARY KEY,version INTEGER NOT NULL CHECK(version>0),updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS daily_expenses(id TEXT PRIMARY KEY,date TEXT NOT NULL REFERENCES daily_expense_days(date),category TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),note TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS daily_expense_history(date TEXT NOT NULL REFERENCES daily_expense_days(date),version INTEGER NOT NULL,changed_by TEXT NOT NULL,changed_at TEXT NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(date,version));
 `);for(const version of [3,4,8])db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (?,?)").run(version,new Date().toISOString());}).immediate();
 const salesLineColumns=db.prepare("PRAGMA table_info(sales_lines)").all() as {name:string}[];
 if(!salesLineColumns.some(column=>column.name==="unit_price_cents"))db.exec("ALTER TABLE sales_lines ADD COLUMN unit_price_cents INTEGER CHECK(unit_price_cents IS NULL OR unit_price_cents BETWEEN 0 AND 100000000)");
 if(!salesLineColumns.some(column=>column.name==="ingredient_cost_per_serving_cents"))db.exec("ALTER TABLE sales_lines ADD COLUMN ingredient_cost_per_serving_cents INTEGER CHECK(ingredient_cost_per_serving_cents IS NULL OR ingredient_cost_per_serving_cents BETWEEN 0 AND 100000000)");
 if(!salesLineColumns.some(column=>column.name==="cost_snapshot"))db.exec("ALTER TABLE sales_lines ADD COLUMN cost_snapshot TEXT");
 db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (6,?)").run(new Date().toISOString());

 function provenance(date:string){return db.prepare("SELECT source_file AS sourceFile,source_date AS sourceDate,source_rows AS sourceRows FROM sales_provenance WHERE date=?").get(date) as {sourceFile:string;sourceDate:string;sourceRows:string}|undefined;}
 function history(date:string){salesDate(date);return db.prepare("SELECT version,changed_by AS changedBy,changed_at AS changedAt,snapshot FROM sales_history WHERE date=? ORDER BY version DESC").all(date);}
 function day(date:string):SalesDay{
  salesDate(date);
  const d=db.prepare("SELECT date,version,updated_by AS updatedBy,updated_at AS updatedAt FROM sales_days WHERE date=?").get(date) as Omit<SalesDay,"lines">|undefined;
  if(!d)return emptySalesDay(date);
  const rows=db.prepare("SELECT l.menu_id AS menuId,l.quantity,l.sold_out AS soldOut,l.unit_price_cents AS unitPriceCents,l.ingredient_cost_per_serving_cents AS ingredientCostPerServingCents,l.cost_snapshot AS costSnapshot FROM sales_lines l JOIN menus m ON m.id=l.menu_id WHERE l.date=? ORDER BY m.position").all(date) as (Omit<SaleLine,"soldOut"|"costSnapshot">&{soldOut:number;costSnapshot:string|null})[];
  return {...d,provenance:provenance(date)??null,lines:rows.map(line=>({...line,soldOut:Boolean(line.soldOut),costSnapshot:line.costSnapshot?JSON.parse(line.costSnapshot) as RecipeCostSnapshot:null}))};
 }
 function menuPrices():Record<string,number|null>{return Object.fromEntries((recipes.list()).map(recipe=>[recipe.id,recipe.priceCents]));}
 function menuCosts():Record<string,RecipeCostSnapshot>{const stock=inventory.list();return Object.fromEntries(recipes.list().map(recipe=>[recipe.id,costRecipe(recipe,stock.packs,stock.prices)]));}
 function expenseState(date:string){salesDate(date);const row=db.prepare("SELECT version FROM daily_expense_days WHERE date=?").get(date) as {version:number}|undefined;const expenses=db.prepare("SELECT id,category,amount_cents AS amountCents,note FROM daily_expenses WHERE date=? ORDER BY rowid").all(date) as DailyExpense[];return {expenses,expenseVersion:row?.version??0};}
 function financial(date:string):FinancialSummary{
  salesDate(date);
  const sales=db.prepare(`SELECT COUNT(DISTINCT d.date) AS salesDays,COUNT(l.quantity) AS entered,
   CASE WHEN SUM(CASE WHEN l.quantity>0 AND l.unit_price_cents IS NULL THEN 1 ELSE 0 END)>0 THEN NULL ELSE SUM(COALESCE(l.quantity,0)*COALESCE(l.unit_price_cents,0)) END AS revenueCents,
   CASE WHEN SUM(CASE WHEN l.quantity>0 AND l.ingredient_cost_per_serving_cents IS NULL THEN 1 ELSE 0 END)>0 THEN NULL ELSE SUM(COALESCE(l.quantity,0)*COALESCE(l.ingredient_cost_per_serving_cents,0)) END AS ingredientCostCents
   FROM sales_days d LEFT JOIN sales_lines l ON l.date=d.date WHERE d.date=?`).get(date) as {salesDays:number;entered:number;revenueCents:number|null;ingredientCostCents:number|null};
  const expenses=(db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS total FROM daily_expenses WHERE date=?").get(date) as {total:number}).total;
  const revenueCents=sales.salesDays===0?null:sales.revenueCents;
  const ingredientCostCents=sales.salesDays===0?null:sales.ingredientCostCents;
  const grossProfitCents=revenueCents===null||ingredientCostCents===null?null:revenueCents-ingredientCostCents;
  return {date,revenueCents,ingredientCostCents,expensesCents:expenses,grossProfitCents,netProfitCents:grossProfitCents===null?null:grossProfitCents-expenses,salesDays:sales.salesDays};
 }
 function recent():SalesSummary[]{
  const dates=db.prepare("SELECT d.date,d.version,d.updated_at AS updatedAt,p.source_date AS sourceDate,COUNT(l.quantity) AS entered,COALESCE(SUM(l.quantity),0) AS total FROM sales_days d JOIN sales_lines l ON l.date=d.date LEFT JOIN sales_provenance p ON p.date=d.date GROUP BY d.date ORDER BY d.date DESC LIMIT 30").all() as (Omit<SalesSummary,keyof FinancialSummary|"updatedAt"|"sourceDate">&{date:string;version:number;updatedAt:string;sourceDate:string|null;entered:number;total:number})[];
  return dates.map(row=>({...row,...financial(row.date)}));
 }
 function trend(period:SalesTrendPeriod,endDate:string):FinancialSummary[]{
  salesDate(endDate);
  let firstDate:string;
  if(period==="daily")firstDate=addDays(endDate,-29);
  else if(period==="weekly"){
   const weekday=new Date(endDate+"T00:00:00Z").getUTCDay();const monday=addDays(endDate,-((weekday+6)%7));firstDate=addDays(monday,-77);
  }else{
   const start=new Date(endDate+"T00:00:00Z");start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-11);firstDate=start.toISOString().slice(0,10);
  }
  const salesRows=db.prepare(`SELECT d.date,
   CASE WHEN SUM(CASE WHEN l.quantity>0 AND l.unit_price_cents IS NULL THEN 1 ELSE 0 END)>0 THEN NULL ELSE SUM(COALESCE(l.quantity,0)*COALESCE(l.unit_price_cents,0)) END AS revenueCents,
   CASE WHEN SUM(CASE WHEN l.quantity>0 AND l.ingredient_cost_per_serving_cents IS NULL THEN 1 ELSE 0 END)>0 THEN NULL ELSE SUM(COALESCE(l.quantity,0)*COALESCE(l.ingredient_cost_per_serving_cents,0)) END AS ingredientCostCents
   FROM sales_days d LEFT JOIN sales_lines l ON l.date=d.date WHERE d.date BETWEEN ? AND ? GROUP BY d.date`).all(firstDate,endDate) as {date:string;revenueCents:number|null;ingredientCostCents:number|null}[];
  const expenseRows=db.prepare("SELECT date,SUM(amount_cents) AS expensesCents FROM daily_expenses WHERE date BETWEEN ? AND ? GROUP BY date").all(firstDate,endDate) as {date:string;expensesCents:number}[];
  const salesByDate=new Map(salesRows.map(row=>[row.date,row]));const expenseByDate=new Map(expenseRows.map(row=>[row.date,row.expensesCents]));
  const bucketKey=(date:string)=>{
   if(period==="daily")return date;
   if(period==="monthly")return date.slice(0,7);
   const weekday=new Date(date+"T00:00:00Z").getUTCDay();return addDays(date,-((weekday+6)%7));
  };
  const buckets=new Map<string,{revenue:number;cost:number;expenses:number;salesDays:number;revenueUnknown:boolean;costUnknown:boolean}>();
  for(let date=firstDate;date<=endDate;date=addDays(date,1)){
   const key=bucketKey(date);let bucket=buckets.get(key);
   if(!bucket){bucket={revenue:0,cost:0,expenses:0,salesDays:0,revenueUnknown:false,costUnknown:false};buckets.set(key,bucket);}
   bucket.expenses+=expenseByDate.get(date)??0;
   const sale=salesByDate.get(date);
   if(sale){bucket.salesDays++;if(sale.revenueCents===null)bucket.revenueUnknown=true;else bucket.revenue+=sale.revenueCents;if(sale.ingredientCostCents===null)bucket.costUnknown=true;else bucket.cost+=sale.ingredientCostCents;}
  }
  return [...buckets].map(([date,bucket])=>{
   const revenueCents=bucket.revenueUnknown?null:bucket.revenue;const ingredientCostCents=bucket.costUnknown?null:bucket.cost;
   const grossProfitCents=revenueCents===null||ingredientCostCents===null?null:revenueCents-ingredientCostCents;
   return {date,revenueCents,ingredientCostCents,expensesCents:bucket.expenses,grossProfitCents,netProfitCents:grossProfitCents===null?null:grossProfitCents-bucket.expenses,salesDays:bucket.salesDays};
  });
 }
 function getData(date:string,period:SalesTrendPeriod):SalesData{return {day:day(date),previousDay:day(addDays(date,-1)),recent:recent(),menuPrices:menuPrices(),menuCosts:menuCosts(),...expenseState(date),trend:trend(period,date),trendPeriod:period};}
 function spreadsheetSales():SalesDay[]{
  const dates=db.prepare("SELECT date FROM sales_days ORDER BY date").all() as {date:string}[];
  return dates.map(({date})=>day(date));
 }
 function spreadsheetExpenses(){
  return db.prepare(`SELECT e.id,e.date,e.category,e.amount_cents AS amountCents,e.note,d.version
   FROM daily_expenses e JOIN daily_expense_days d ON d.date=e.date
   ORDER BY e.date,e.rowid`).all() as (DailyExpense&{date:string;version:number})[];
 }
 function save(value:unknown,actor:string,demoDate?:string,period:SalesTrendPeriod="daily"){
  const input=validateSales(value);if(actor!=="owner"&&actor!=="staff")throw new Error("Owner access required.");
  db.transaction(()=>{
   const current=day(input.date);if(current.version!==input.version)throw new SalesConflictError("Sales for this date changed in another window. Reload this date before saving.");
   const now=new Date().toISOString();const version=input.version+1;
   db.prepare("INSERT INTO sales_days VALUES (?,?,?,?) ON CONFLICT(date) DO UPDATE SET version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at").run(input.date,version,actor,now);
   const prices=menuPrices();const costs=menuCosts();
   const insert=db.prepare(`INSERT INTO sales_lines (date,menu_id,quantity,sold_out,unit_price_cents,ingredient_cost_per_serving_cents,cost_snapshot) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(date,menu_id) DO UPDATE SET quantity=excluded.quantity,sold_out=excluded.sold_out,unit_price_cents=excluded.unit_price_cents,ingredient_cost_per_serving_cents=excluded.ingredient_cost_per_serving_cents,cost_snapshot=excluded.cost_snapshot`);
   input.lines.forEach(line=>{
    const previous=current.lines.find(item=>item.menuId===line.menuId);
    const costSnapshot=previous?.costSnapshot??(line.quantity===null?null:costs[line.menuId]);
    const unitCost=previous?.ingredientCostPerServingCents??costSnapshot?.perServingCostCents??null;
    insert.run(input.date,line.menuId,line.quantity,line.soldOut?1:0,previous?.unitPriceCents??(line.quantity===null?null:prices[line.menuId]),unitCost,costSnapshot?JSON.stringify(costSnapshot):null);
   });
   if(demoDate){
    const source=demoSales.days.find(d=>d.date===input.date&&d.sourceDate===demoDate);
    if(!source)throw new Error("Unknown demo source date.");
    db.prepare("INSERT OR IGNORE INTO sales_provenance VALUES (?,?,?,?,?)").run(input.date,demoSales.sourceFile,source.sourceDate,JSON.stringify(source.sourceRows),demoSales.sourceSha256);
   }
   const saved=day(input.date);db.prepare("INSERT INTO sales_history VALUES (?,?,?,?,?)").run(input.date,version,actor,now,JSON.stringify(saved));
  }).immediate();
  return getData(input.date,period);
 }
 function fillMissingFinancials(value:unknown,actor:string,period:SalesTrendPeriod="daily"){
  if(actor!=="owner")throw new SalesInputError("Only the owner can fill missing prices and costs.");
  if(!value||typeof value!=="object"||Array.isArray(value))throw new SalesInputError("Choose a saved sales record.");
  const input=value as {date?:unknown;version?:unknown};const date=salesDate(input.date);
  if(!Number.isSafeInteger(input.version)||(input.version as number)<1)throw new SalesInputError("Choose a saved sales record.");
  db.transaction(()=>{
   const current=day(date);
   if(current.version!==input.version)throw new SalesConflictError("Sales for this date changed. Reload before filling missing prices and costs.");
   const prices=menuPrices();const costs=menuCosts();let changed=false;
   const lines=current.lines.map(line=>{
    if(line.quantity===null)return line;
    const unitPriceCents=line.unitPriceCents??prices[line.menuId];
    const ingredientCostPerServingCents=line.ingredientCostPerServingCents??costs[line.menuId].perServingCostCents;
    if(line.quantity>0&&(unitPriceCents===null||ingredientCostPerServingCents===null))throw new SalesInputError("Set all selling prices in Recipes and ingredient prices in Inventory before filling this record.");
    if(unitPriceCents===line.unitPriceCents&&ingredientCostPerServingCents===line.ingredientCostPerServingCents)return line;
    changed=true;
    return {...line,unitPriceCents,ingredientCostPerServingCents,costSnapshot:line.ingredientCostPerServingCents===null&&ingredientCostPerServingCents!==null?costs[line.menuId]:line.costSnapshot};
   });
   if(!changed)return;
   const now=new Date().toISOString();const version=current.version+1;
   const update=db.prepare("UPDATE sales_lines SET unit_price_cents=?,ingredient_cost_per_serving_cents=?,cost_snapshot=? WHERE date=? AND menu_id=?");
   for(const line of lines)update.run(line.unitPriceCents,line.ingredientCostPerServingCents,line.costSnapshot?JSON.stringify(line.costSnapshot):null,date,line.menuId);
   db.prepare("UPDATE sales_days SET version=?,updated_by=?,updated_at=? WHERE date=?").run(version,actor,now,date);
   db.prepare("INSERT INTO sales_history VALUES (?,?,?,?,?)").run(date,version,actor,now,JSON.stringify({...day(date),financialCorrection:"Missing values filled using current selling prices and recipe costs."}));
  }).immediate();
  return getData(date,period);
 }
 function saveExpenses(value:unknown,actor:string,period:SalesTrendPeriod="daily"){
  if(actor!=="owner"&&actor!=="staff")throw new Error("Owner access required.");
  const input=validateExpenses(value);
  db.transaction(()=>{
   const current=db.prepare("SELECT version FROM daily_expense_days WHERE date=?").get(input.date) as {version:number}|undefined;
   if((current?.version??0)!==input.version)throw new ExpenseConflictError("Expenses for this date changed in another window. Reload before saving.");
   const version=input.version+1;const now=new Date().toISOString();
   db.prepare("INSERT INTO daily_expense_days VALUES (?,?,?,?) ON CONFLICT(date) DO UPDATE SET version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at").run(input.date,version,actor,now);
   db.prepare("DELETE FROM daily_expenses WHERE date=?").run(input.date);
   const insert=db.prepare("INSERT INTO daily_expenses (id,date,category,amount_cents,note) VALUES (?,?,?,?,?)");
   input.expenses.forEach(expense=>insert.run(randomUUID(),input.date,expense.category,expense.amountCents,expense.note));
   const saved=expenseState(input.date).expenses;
   db.prepare("INSERT INTO daily_expense_history VALUES (?,?,?,?,?)").run(input.date,version,actor,now,JSON.stringify({date:input.date,expenses:saved}));
  }).immediate();
  return getData(input.date,period);
 }
 function importDemo(actor:string){if(actor!=="owner")throw new Error("Owner access required.");return db.transaction(()=>{
  const imported:string[]=[];const skipped:string[]=[];
  for(const d of demoSales.days.slice(0,6)){
   if(day(d.date).version>0){skipped.push(d.date);continue;}
   save({date:d.date,version:0,lines:d.lines},actor,d.sourceDate);imported.push(d.date);
  }
  return {imported,skipped,manualEntryDate:demoSales.days[6].date};
 }).immediate();}
 return {day,recent,menuPrices,menuCosts,expenseState,financial,trend,getData,spreadsheetSales,spreadsheetExpenses,save,fillMissingFinancials,saveExpenses,history,importDemo,close:()=>{db.close();recipes.close();inventory.close();}};
}
