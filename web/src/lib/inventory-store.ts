import Database from "better-sqlite3";
import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {openRecipeStore} from "./recipe-store";
import {ingredients,baseQuantity,type IngredientId} from "./recipes";
import {priceUnit,type IngredientPrice,validateBatch,demoExpiryDate,demoStock,addDays,malaysiaDate,InventoryInputError,type Batch,type Pack,type Inventory} from "./inventory";
export class InventoryPermissionError extends Error {}
export class InventoryConflictError extends Error {}
export function openInventoryStore(filename=process.env.DAPURPLAN_DB_PATH||resolve(process.cwd(),"data/dapurplan.sqlite")){
 // Initialise the shared ingredient catalogue before referencing its IDs.
 const recipes=openRecipeStore(filename);recipes.close();
 const db=new Database(filename);db.pragma("foreign_keys = ON");db.pragma("busy_timeout = 5000");
 db.transaction(()=>{db.exec(`
 CREATE TABLE IF NOT EXISTS inventory_batches(id TEXT PRIMARY KEY,ingredient_id TEXT NOT NULL REFERENCES ingredients(id),quantity REAL NOT NULL CHECK(quantity>=0),unit TEXT NOT NULL,count_date TEXT NOT NULL,expiry_date TEXT,version INTEGER NOT NULL,is_demo INTEGER NOT NULL,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS inventory_packs(ingredient_id TEXT PRIMARY KEY REFERENCES ingredients(id),quantity REAL NOT NULL CHECK(quantity>0),unit TEXT NOT NULL,label TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS inventory_history(id INTEGER PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES inventory_batches(id),changed_by TEXT NOT NULL,changed_at TEXT NOT NULL,snapshot TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ingredient_cost_history(id INTEGER PRIMARY KEY,ingredient_id TEXT NOT NULL REFERENCES ingredients(id),changed_by TEXT NOT NULL,changed_at TEXT NOT NULL,snapshot TEXT NOT NULL);
 `);db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (2,?)").run(new Date().toISOString());}).immediate();
 db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (9,?)").run(new Date().toISOString());
 const packColumns=db.prepare("PRAGMA table_info(inventory_packs)").all() as {name:string}[];
 if(!packColumns.some(column=>column.name==="cost_cents"))db.exec("ALTER TABLE inventory_packs ADD COLUMN cost_cents INTEGER CHECK(cost_cents IS NULL OR cost_cents BETWEEN 0 AND 100000000)");
 db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (7,?)").run(new Date().toISOString());
 // Convert legacy pack prices once; later pack changes cannot change baseline prices.
 db.transaction(()=>{
  db.exec("CREATE TABLE IF NOT EXISTS ingredient_prices(ingredient_id TEXT PRIMARY KEY REFERENCES ingredients(id),unit TEXT NOT NULL,cost_cents INTEGER CHECK(cost_cents IS NULL OR cost_cents BETWEEN 0 AND 100000000),version INTEGER NOT NULL CHECK(version>0))");
  if(!db.prepare("SELECT 1 FROM schema_migrations WHERE version=10").get()){
   const packs=db.prepare("SELECT ingredient_id AS ingredientId,quantity,unit,cost_cents AS costCents FROM inventory_packs WHERE cost_cents IS NOT NULL").all() as Pack[];
   for(const pack of packs){const unit=priceUnit(pack.ingredientId);const cost=Math.round(pack.costCents!*baseQuantity(1,unit)/baseQuantity(pack.quantity,pack.unit));db.prepare("INSERT OR IGNORE INTO ingredient_prices (ingredient_id,unit,cost_cents,version) VALUES (?,?,?,1)").run(pack.ingredientId,unit,cost);}
   db.prepare("INSERT INTO schema_migrations VALUES (10,?)").run(new Date().toISOString());
  }
 }).immediate();
 db.transaction(()=>{
  const columns=db.prepare("PRAGMA table_info(ingredient_prices)").all() as {name:string}[];
  if(!columns.some(c=>c.name==="quantity"))db.exec("ALTER TABLE ingredient_prices ADD COLUMN quantity REAL NOT NULL DEFAULT 1 CHECK(quantity>0)");
  if(!db.prepare("SELECT 1 FROM schema_migrations WHERE version=11").get()){
   db.exec("UPDATE ingredient_prices SET quantity=30,cost_cents=cost_cents*30 WHERE ingredient_id='egg'");
   db.prepare("INSERT INTO schema_migrations VALUES (11,?)").run(new Date().toISOString());
  }
 }).immediate();
 db.transaction(()=>{
  if(!db.prepare("SELECT 1 FROM schema_migrations WHERE version=12").get()){
   db.exec("UPDATE ingredient_prices SET cost_cents=cost_cents*100/quantity,quantity=100 WHERE ingredient_id='tea'");
   db.prepare("INSERT INTO schema_migrations VALUES (12,?)").run(new Date().toISOString());
  }
 }).immediate();
 function prices():IngredientPrice[]{return db.prepare("SELECT ingredient_id AS ingredientId,unit,quantity,cost_cents AS costCents,version FROM ingredient_prices").all() as IngredientPrice[];}
 function savePrice(value:unknown,actor:string,role=actor){
  if(role!=="owner")throw new InventoryPermissionError("Only the owner can update ingredient prices.");
  if(!value||typeof value!=="object"||Array.isArray(value))throw new InventoryInputError("Enter valid ingredient price details.");
  const v=value as Record<string,unknown>;
  if(!ingredients.some(i=>i.id===v.ingredientId))throw new InventoryInputError("Choose a valid ingredient.");
  const id=v.ingredientId as IngredientId;const unit=priceUnit(id);const quantity=id==="egg"?30:id==="tea"?100:1;
  if(v.quantity!==undefined&&v.quantity!==quantity)throw new InventoryInputError("Use the configured price unit for this ingredient.");
  if(v.unit!==unit)throw new InventoryInputError("Use the ingredient's baseline unit.");
  if(v.costCents!==null&&(!Number.isSafeInteger(v.costCents)||(v.costCents as number)<0||(v.costCents as number)>100000000))throw new InventoryInputError("Enter a price from RM 0.00 to RM 1,000,000.00, or leave it blank.");
  if(!Number.isSafeInteger(v.version)||(v.version as number)<0)throw new InventoryInputError("Reload ingredient prices before saving.");
  db.transaction(()=>{
   const previous=prices().find(p=>p.ingredientId===id);
   if((previous?.version??0)!==v.version)throw new InventoryConflictError("This ingredient price changed. Reload before saving.");
   const version=(v.version as number)+1;const now=new Date().toISOString();
   db.prepare("INSERT INTO ingredient_prices (ingredient_id,unit,cost_cents,version,quantity) VALUES (?,?,?,?,?) ON CONFLICT(ingredient_id) DO UPDATE SET unit=excluded.unit,cost_cents=excluded.cost_cents,version=excluded.version,quantity=excluded.quantity").run(id,unit,v.costCents,version,quantity);
   db.prepare("INSERT INTO ingredient_cost_history(ingredient_id,changed_by,changed_at,snapshot) VALUES (?,?,?,?)").run(id,actor,now,JSON.stringify({ingredientId:id,unit,quantity,costCents:v.costCents,previousCostCents:previous?.costCents??null,version}));
  }).immediate();
  return list();
 }
 function list():Inventory{return {prices:prices(),batches:db.prepare("SELECT id,ingredient_id AS ingredientId,quantity,unit,count_date AS countDate,expiry_date AS expiryDate,version,is_demo AS isDemo,updated_by AS updatedBy,updated_at AS updatedAt FROM inventory_batches ORDER BY ingredient_id,expiry_date,id").all().map(v=>{const b=v as Batch;return {...b,isDemo:Boolean(b.isDemo)};}),packs:db.prepare("SELECT ingredient_id AS ingredientId,quantity,unit,label,cost_cents AS costCents FROM inventory_packs").all() as Pack[]};}
 function save(value:unknown,actor:string,demo=false){
  const v=validateBatch(value);if(actor!=="owner"&&actor!=="staff")throw new InventoryPermissionError("Sign in first.");
  return db.transaction(()=>{
   const previousPack=list().packs.find(p=>p.ingredientId===v.ingredientId);
   if(actor==="staff"&&(v.id||demo||!previousPack||previousPack.quantity!==v.packQuantity||previousPack.unit!==v.packUnit||previousPack.label!==v.packLabel||(previousPack.costCents??null)!==(v.packCostCents??null)))throw new InventoryPermissionError("Only the owner can correct stock batches or change purchase pack settings.");
   const current=v.id?list().batches.find(b=>b.id===v.id):undefined;
   if(v.id&&(!current||current.version!==v.version))throw new InventoryConflictError("This batch changed. Reload before saving.");
   if(current&&current.ingredientId!==v.ingredientId)throw new InventoryConflictError("An existing batch cannot change ingredient.");
   const batch:Batch={id:current?.id||randomUUID(),ingredientId:v.ingredientId,quantity:v.quantity,unit:v.unit,countDate:v.countDate,expiryDate:v.expiryDate,version:(current?.version||0)+1,isDemo:current?.isDemo||demo,updatedBy:actor,updatedAt:new Date().toISOString()};
   db.prepare("INSERT INTO inventory_batches VALUES (@id,@ingredientId,@quantity,@unit,@countDate,@expiryDate,@version,@demo,@updatedBy,@updatedAt) ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity,unit=excluded.unit,count_date=excluded.count_date,expiry_date=excluded.expiry_date,version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at").run({...batch,demo:batch.isDemo?1:0});
   const packCostCents=v.packCostCents===undefined?previousPack?.costCents??null:v.packCostCents;
   db.prepare("INSERT INTO inventory_packs (ingredient_id,quantity,unit,label,cost_cents) VALUES (?,?,?,?,?) ON CONFLICT(ingredient_id) DO UPDATE SET quantity=excluded.quantity,unit=excluded.unit,label=excluded.label,cost_cents=excluded.cost_cents").run(v.ingredientId,v.packQuantity,v.packUnit,v.packLabel,packCostCents);
   db.prepare("INSERT INTO inventory_history(batch_id,changed_by,changed_at,snapshot) VALUES (?,?,?,?)").run(batch.id,actor,batch.updatedAt,JSON.stringify({batch,pack:{quantity:v.packQuantity,unit:v.packUnit,label:v.packLabel,costCents:packCostCents}}));
   return list();
  }).immediate();
 }
 function seed(actor:string){if(actor!=="owner")throw new Error("Owner access required.");return db.transaction(()=>{
  if(db.prepare("SELECT id FROM inventory_batches LIMIT 1").get())throw new InventoryConflictError("Demo stock can only be loaded into an empty inventory. Existing stock is untouched.");
  const today=malaysiaDate();
  for(const [ingredientId,quantity,unit,packQuantity,packUnit,packLabel] of demoStock){
   const portions=ingredientId==="chicken"?[quantity/2,quantity/2]:[quantity];
   portions.forEach((q,index)=>{save({ingredientId,quantity:q,unit,countDate:today,expiryDate:demoExpiryDate(ingredientId,today,index),packQuantity,packUnit,packLabel},actor,true);});
  }
  return list();
 }).immediate();}
 // Compatibility for older clients; all new screens use savePrice.
 function saveWaterCost(value:unknown,actor:string,role=actor){
  const v=value as {costCents?:unknown}|null;
  return db.transaction(()=>{
   const current=prices().find(p=>p.ingredientId==="water");
   savePrice({ingredientId:"water",unit:"L",costCents:v?.costCents,version:current?.version??0},actor,role);
   db.prepare("INSERT INTO inventory_packs (ingredient_id,quantity,unit,label,cost_cents) VALUES ('water',1,'L','litre',?) ON CONFLICT(ingredient_id) DO UPDATE SET cost_cents=excluded.cost_cents").run(v?.costCents);
   return list();
  }).immediate();
 }
 function fillDemoExpiries(actor:string){if(actor!=="owner")throw new Error("Owner access required.");return db.transaction(()=>{
  const current=list();const updated:string[]=[];
  for(const b of current.batches){if(!b.isDemo||b.expiryDate)continue;const p=current.packs.find(p=>p.ingredientId===b.ingredientId);if(!p)throw new Error("Demo purchase pack is missing.");save({...b,expiryDate:demoExpiryDate(b.ingredientId,malaysiaDate()),packQuantity:p.quantity,packUnit:p.unit,packLabel:p.label},actor);updated.push(b.ingredientId);}
  return {updated,preserved:current.batches.length-updated.length};
 }).immediate();}
 return {list,save,savePrice,saveWaterCost,seed,fillDemoExpiries,close:()=>db.close()};
}
