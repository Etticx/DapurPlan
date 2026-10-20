import Database from "better-sqlite3";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {openForecastStore} from "./forecast-store";
import {openRecipeStore} from "./recipe-store";
import {openInventoryStore} from "./inventory-store";
import {malaysiaDate} from "./inventory";
import {ingredientNeeds,validatePrep,PlanInputError,type PlanningView,type PlanSnapshot} from "./planning";
export class PlanConflictError extends Error {}
export function openPlanStore(filename=process.env.DAPURPLAN_DB_PATH||resolve(process.cwd(),"data/dapurplan.sqlite")){
 const forecasts=openForecastStore(filename);const recipes=openRecipeStore(filename);const inventory=openInventoryStore(filename);const db=new Database(filename);db.pragma("busy_timeout = 5000");
 db.transaction(()=>{db.exec("CREATE TABLE IF NOT EXISTS preparation_plans(id INTEGER PRIMARY KEY AUTOINCREMENT,target_date TEXT NOT NULL,forecast_id INTEGER NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','approved')),snapshot TEXT NOT NULL); CREATE INDEX IF NOT EXISTS preparation_plans_date ON preparation_plans(target_date,id);");db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (6,?)").run(new Date().toISOString());}).immediate();
 function latest(date:string):PlanSnapshot|null{const row=db.prepare("SELECT id,snapshot FROM preparation_plans WHERE target_date=? ORDER BY id DESC LIMIT 1").get(date) as {id:number;snapshot:string}|undefined;return row?{...JSON.parse(row.snapshot),id:row.id}:null;}
 function view():PlanningView{
  const forecast=forecasts.view();const recipeList=recipes.list();const stock=inventory.list();const saved=latest(forecast.targetDate);
  const basisKey=createHash("sha256").update(JSON.stringify({forecastId:forecast.latest?.id,inputKey:forecast.latest?.inputKey,stale:forecast.stale,recipes:recipeList,inventory:stock})).digest("hex");
  return {forecast,recipes:recipeList,inventory:stock,basisKey,saved,planStale:!!saved&&(saved.basisKey!==basisKey||forecast.stale)};
 }
 function save(value:unknown,actor:string){
  if(actor!=="owner")throw new Error("Owner access required.");
  if(!value||typeof value!=="object"||Array.isArray(value))throw new PlanInputError("Enter a valid plan.");const v=value as Record<string,unknown>;
  if(v.action!=="save"&&v.action!=="approve")throw new PlanInputError("Choose save or approve.");
  return db.transaction(()=>{
   const current=view();const f=current.forecast.latest;
   if(!f||current.forecast.stale||current.forecast.missing.length)throw new PlanConflictError("Generate a current forecast before saving or approving a plan.");
   if(v.basisKey!==current.basisKey||v.forecastId!==f.id||v.expectedPlanId!==(current.saved?.id??0))throw new PlanConflictError("Sales, recipes, stock or the plan changed. Refresh and review before saving.");
   const prep=validatePrep(v.prep,f);
   if(v.action==="approve"&&v.stockReviewed!==true)throw new PlanInputError("Confirm you checked stock quantities, expiry and purchase suggestions before approving.");
   const needs=ingredientNeeds(prep,current.recipes,current.inventory,f.targetDate,malaysiaDate());
   const record:Omit<PlanSnapshot,"id">={forecastId:f.id,targetDate:f.targetDate,status:v.action==="approve"?"approved":"draft",createdAt:new Date().toISOString(),createdBy:actor,basisKey:current.basisKey,prep,needs,sources:{forecast:f,recipes:current.recipes,inventory:current.inventory},stockReviewed:v.action==="approve"};
   db.prepare("INSERT INTO preparation_plans(target_date,forecast_id,created_at,created_by,status,snapshot) VALUES (?,?,?,?,?,?)").run(record.targetDate,f.id,record.createdAt,actor,record.status,JSON.stringify(record));return view();
  }).immediate();
 }
 return {view,save,latest,close:()=>{forecasts.close();recipes.close();inventory.close();db.close();}};
}
