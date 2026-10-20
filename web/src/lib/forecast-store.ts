import Database from "better-sqlite3";
import {resolve} from "node:path";
import {openSalesStore} from "./sales-store";
import {buildForecastInputs,type PreparedForecast,type SavedForecast,type ForecastView} from "./forecast";
import {addDays,malaysiaDate} from "./inventory";
export class ForecastHistoryError extends Error {}
export function openForecastStore(filename=process.env.DAPURPLAN_DB_PATH||resolve(process.cwd(),"data/dapurplan.sqlite")){
 const sales=openSalesStore(filename);const db=new Database(filename);db.pragma("busy_timeout = 5000");
 db.transaction(()=>{db.exec("CREATE TABLE IF NOT EXISTS forecasts(id INTEGER PRIMARY KEY AUTOINCREMENT,target_date TEXT NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL,snapshot TEXT NOT NULL); CREATE INDEX IF NOT EXISTS forecasts_target ON forecasts(target_date,id);");db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (5,?)").run(new Date().toISOString());}).immediate();
 function prepare(){const targetDate=addDays(malaysiaDate(),1);return db.transaction(()=>buildForecastInputs(targetDate,Array.from({length:7},(_,i)=>sales.day(addDays(targetDate,i-7)))))();}
 function latest(targetDate:string):SavedForecast|null{const row=db.prepare("SELECT id,snapshot FROM forecasts WHERE target_date=? ORDER BY id DESC LIMIT 1").get(targetDate) as {id:number;snapshot:string}|undefined;return row?{...JSON.parse(row.snapshot),id:row.id}:null;}
 function view():ForecastView{const p=prepare();const saved=latest(p.targetDate);return {targetDate:p.targetDate,historyStart:addDays(p.targetDate,-7),historyEnd:addDays(p.targetDate,-1),missing:p.missing,hasDemoData:p.hasDemoData,soldOutCount:p.soldOutCount,latest:saved,stale:!!saved&&saved.inputKey!==p.inputKey};}
 function save(p:PreparedForecast,result:Pick<SavedForecast,"modelId"|"syntheticModel"|"predictions">,actor:string){if(actor!=="owner")throw new Error("Owner access required.");return db.transaction(()=>{
  const current=prepare();if(p.targetDate!==current.targetDate||p.inputKey!==current.inputKey||current.missing.length)throw new ForecastHistoryError("Sales changed while forecasting. Review the latest sales and generate again.");
  const record={targetDate:p.targetDate,createdAt:new Date().toISOString(),createdBy:actor,inputs:p.inputs,history:p.days,inputKey:p.inputKey,...result};
  const inserted=db.prepare("INSERT INTO forecasts(target_date,created_at,created_by,snapshot) VALUES (?,?,?,?)").run(record.targetDate,record.createdAt,actor,JSON.stringify(record));return {...record,id:Number(inserted.lastInsertRowid)};
 }).immediate();}
 return {prepare,view,save,latest,close:()=>{sales.close();db.close();}};
}
