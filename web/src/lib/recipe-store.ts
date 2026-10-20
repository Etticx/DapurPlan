import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { demoRecipes, ingredients, type Recipe } from "./recipes";
import { validateRecipeUpdate } from "./recipe-validation";

export type StoredRecipe = Recipe & {version:number; updatedAt:string; updatedBy:string; isDemo:boolean};
export class RecipeConflictError extends Error {}
export class RecipeNotFoundError extends Error {}

// One local SQLite file. Callers in Next.js must sit behind a server-only boundary.
export function openRecipeStore(filename=process.env.DAPURPLAN_DB_PATH || resolve(process.cwd(), "data/dapurplan.sqlite")) {
  mkdirSync(dirname(resolve(/* turbopackIgnore: true */ filename)),{recursive:true});
  const db=new Database(filename);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS menus (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('Food','Drink')), position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ingredients (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('weight','liquid','count')), stock_tracked INTEGER NOT NULL CHECK(stock_tracked IN (0,1)));
    CREATE TABLE IF NOT EXISTS recipes (menu_id TEXT PRIMARY KEY REFERENCES menus(id), servings INTEGER NOT NULL CHECK(servings BETWEEN 1 AND 10000), version INTEGER NOT NULL CHECK(version>0), updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, is_demo INTEGER NOT NULL CHECK(is_demo IN (0,1)));
    CREATE TABLE IF NOT EXISTS recipe_lines (menu_id TEXT NOT NULL REFERENCES recipes(menu_id), ingredient_id TEXT NOT NULL REFERENCES ingredients(id), quantity REAL NOT NULL CHECK(quantity>0), unit TEXT NOT NULL CHECK(unit IN ('g','kg','ml','L','pieces')), position INTEGER NOT NULL, PRIMARY KEY(menu_id,ingredient_id));
    CREATE TABLE IF NOT EXISTS recipe_versions (menu_id TEXT NOT NULL REFERENCES menus(id), version INTEGER NOT NULL, changed_at TEXT NOT NULL, changed_by TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(menu_id,version));
  `);
  const insertLine=db.prepare("INSERT INTO recipe_lines VALUES (?,?,?,?,?)");
  // Seed once in a transaction; future starts never reset owner edits.
  db.transaction(()=>{
    if (db.prepare("SELECT version FROM schema_migrations WHERE version=1").get()) return;
    const now=new Date().toISOString();
    for (const i of ingredients) db.prepare("INSERT INTO ingredients VALUES (?,?,?,?)").run(i.id,i.name,i.kind,i.id==="water"?0:1);
    demoRecipes.forEach((r,index)=>{
      db.prepare("INSERT INTO menus VALUES (?,?,?,?)").run(r.id,r.name,r.category,index);
      db.prepare("INSERT INTO recipes VALUES (?,?,?,?,?,?)").run(r.id,r.servings,1,now,"system:demo-seed",1);
      r.lines.forEach((l,p)=>insertLine.run(r.id,l.ingredientId,l.quantity,l.unit,p));
      db.prepare("INSERT INTO recipe_versions VALUES (?,?,?,?,?)").run(r.id,1,now,"system:demo-seed",JSON.stringify({...r,version:1,updatedAt:now,updatedBy:"system:demo-seed",isDemo:true}));
    });
    db.prepare("INSERT INTO schema_migrations VALUES (1,?)").run(now);
  }).immediate();

  function list():StoredRecipe[] {
    const rows=db.prepare(`SELECT m.id,m.name,m.category,r.servings,r.version,r.updated_at AS updatedAt,r.updated_by AS updatedBy,r.is_demo AS isDemo FROM menus m JOIN recipes r ON m.id=r.menu_id ORDER BY m.position`).all() as (Omit<StoredRecipe,"lines"|"isDemo"> & {isDemo:number})[];
    return rows.map(r=>({...r,isDemo:Boolean(r.isDemo),lines:db.prepare("SELECT ingredient_id AS ingredientId,quantity,unit FROM recipe_lines WHERE menu_id=? ORDER BY position").all(r.id) as Recipe["lines"]}));
  }
  function history(id:string) {
    return db.prepare("SELECT version,changed_at AS changedAt,changed_by AS changedBy,snapshot FROM recipe_versions WHERE menu_id=? ORDER BY version DESC").all(id).map(row=>{const r=row as {version:number;changedAt:string;changedBy:string;snapshot:string};return {...r,snapshot:JSON.parse(r.snapshot) as StoredRecipe};});
  }
  function update(id:string,value:unknown,actor:string):StoredRecipe {
    const input=validateRecipeUpdate(value);
    if (actor!=="owner") throw new Error("Owner access required.");
    return db.transaction(()=>{
      const current=list().find(r=>r.id===id);
      if (!current) throw new RecipeNotFoundError("Recipe not found.");
      if (current.version!==input.version) throw new RecipeConflictError("This recipe changed in another window. Reload before saving; your changes have not been saved.");
      const next:StoredRecipe={...current,servings:input.servings,lines:input.lines,version:current.version+1,updatedAt:new Date().toISOString(),updatedBy:actor,isDemo:false};
      db.prepare("UPDATE recipes SET servings=?,version=?,updated_at=?,updated_by=?,is_demo=0 WHERE menu_id=?").run(next.servings,next.version,next.updatedAt,actor,id);
      db.prepare("DELETE FROM recipe_lines WHERE menu_id=?").run(id);
      next.lines.forEach((l,p)=>insertLine.run(id,l.ingredientId,l.quantity,l.unit,p));
      // The snapshot and current recipe commit together, or both roll back.
      db.prepare("INSERT INTO recipe_versions VALUES (?,?,?,?,?)").run(id,next.version,next.updatedAt,actor,JSON.stringify(next));
      return next;
    }).immediate();
  }
  return {list,history,update,close:()=>db.close()};
}
