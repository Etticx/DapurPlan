import Database from "better-sqlite3";
import {resolve} from "node:path";
import {openRecipeStore} from "./recipe-store";
import {validateSales,salesDate,emptySalesDay,type SalesDay,type SalesSummary,type SaleLine} from "./sales";
export class SalesConflictError extends Error {}
export function openSalesStore(filename=process.env.DAPURPLAN_DB_PATH||resolve(process.cwd(),"data/dapurplan.sqlite")){
 const recipes=openRecipeStore(filename);recipes.close();
 const db=new Database(filename);db.pragma("foreign_keys = ON");db.pragma("busy_timeout = 5000");
 db.transaction(()=>{db.exec(`
 CREATE TABLE IF NOT EXISTS sales_days(date TEXT PRIMARY KEY,version INTEGER NOT NULL CHECK(version>0),updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sales_lines(date TEXT NOT NULL REFERENCES sales_days(date),menu_id TEXT NOT NULL REFERENCES menus(id),quantity INTEGER CHECK(quantity IS NULL OR (quantity>=0 AND quantity<=1000000)),sold_out INTEGER NOT NULL CHECK(sold_out IN (0,1)),PRIMARY KEY(date,menu_id));
 CREATE TABLE IF NOT EXISTS sales_history(date TEXT NOT NULL REFERENCES sales_days(date),version INTEGER NOT NULL,changed_by TEXT NOT NULL,changed_at TEXT NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(date,version));
 `);db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (3,?)").run(new Date().toISOString());}).immediate();
 function day(date:string):SalesDay{
  salesDate(date);const d=db.prepare("SELECT date,version,updated_by AS updatedBy,updated_at AS updatedAt FROM sales_days WHERE date=?").get(date) as Omit<SalesDay,"lines">|undefined;
  if(!d)return emptySalesDay(date);
  const rows=db.prepare("SELECT l.menu_id AS menuId,l.quantity,l.sold_out AS soldOut FROM sales_lines l JOIN menus m ON m.id=l.menu_id WHERE l.date=? ORDER BY m.position").all(date) as (Omit<SaleLine,"soldOut">&{soldOut:number})[];
  return {...d,lines:rows.map(l=>({...l,soldOut:Boolean(l.soldOut)}))};
 }
 function recent():SalesSummary[]{return db.prepare("SELECT d.date,d.version,d.updated_at AS updatedAt,COUNT(l.quantity) AS entered,COALESCE(SUM(l.quantity),0) AS total FROM sales_days d JOIN sales_lines l ON l.date=d.date GROUP BY d.date ORDER BY d.date DESC LIMIT 30").all() as SalesSummary[];}
 function history(date:string){salesDate(date);return db.prepare("SELECT version,changed_by AS changedBy,changed_at AS changedAt,snapshot FROM sales_history WHERE date=? ORDER BY version DESC").all(date);}
 function save(value:unknown,actor:string){
  const v=validateSales(value);if(actor!=="owner")throw new Error("Owner access required.");
  return db.transaction(()=>{
   if(day(v.date).version!==v.version)throw new SalesConflictError("Sales for this date changed in another window. Reload this date before saving.");
   const now=new Date().toISOString();const version=v.version+1;
   db.prepare("INSERT INTO sales_days VALUES (?,?,?,?) ON CONFLICT(date) DO UPDATE SET version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at").run(v.date,version,actor,now);
   const insert=db.prepare("INSERT INTO sales_lines VALUES (?,?,?,?) ON CONFLICT(date,menu_id) DO UPDATE SET quantity=excluded.quantity,sold_out=excluded.sold_out");
   v.lines.forEach(l=>insert.run(v.date,l.menuId,l.quantity,l.soldOut?1:0));
   const saved=day(v.date);
   db.prepare("INSERT INTO sales_history VALUES (?,?,?,?,?)").run(v.date,version,actor,now,JSON.stringify(saved));
   return {day:saved,recent:recent()};
  }).immediate();
 }
 return {day,recent,save,history,close:()=>db.close()};
}
