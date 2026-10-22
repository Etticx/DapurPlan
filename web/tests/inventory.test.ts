import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import Database from "better-sqlite3";
import {openInventoryStore} from "../src/lib/inventory-store";
import {validateBatch,malaysiaDate} from "../src/lib/inventory";
test("demo inventory seeds once, survives reopening and never deducts sales",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-inventory-"));const file=join(dir,"test.sqlite");let store=openInventoryStore(file);const raw=new Database(file);
 try{
  assert.equal(store.list().batches.length,0);
  const data=store.seed("owner");assert.equal(data.batches.length,18);assert.equal(data.packs.length,17);assert.equal(data.batches.filter(b=>b.ingredientId==="chicken").length,2);assert.ok(data.batches.every(b=>b.isDemo));assert.ok(data.batches.every(b=>b.ingredientId!=="water"));
  assert.throws(()=>store.seed("owner"));
  const b=data.batches.find(b=>b.ingredientId==="rice")!;const pack=data.packs.find(p=>p.ingredientId===b.ingredientId)!;
  const input={...b,quantity:4,packQuantity:pack.quantity,packUnit:pack.unit,packLabel:pack.label};
  store.save(input,"owner");assert.throws(()=>store.save(input,"owner"));
  store.close();store=openInventoryStore(file);assert.equal(store.list().batches.find(v=>v.id===b.id)!.quantity,4);
  const before=store.list();const history=raw.prepare("SELECT COUNT(*) AS n FROM inventory_history").get();
  raw.exec("CREATE TRIGGER fail_stock_history BEFORE INSERT ON inventory_history BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  assert.throws(()=>store.save({...input,version:2,quantity:2,packQuantity:25},"owner"));assert.deepEqual(store.list(),before);assert.deepEqual(raw.prepare("SELECT COUNT(*) AS n FROM inventory_history").get(),history);
 }finally{raw.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
test("inventory input checks reject wrong units, water and invalid dates",()=>{
 const good={ingredientId:"rice",quantity:5,unit:"kg",countDate:malaysiaDate(),expiryDate:null,packQuantity:5,packUnit:"kg",packLabel:"bag"};
 assert.equal(validateBatch(good).quantity,5);
 for(const patch of [{ingredientId:"water"},{quantity:-1},{quantity:Infinity},{unit:"L"},{countDate:"2026-02-30"},{expiryDate:"bad"},{packQuantity:0},{packUnit:"pieces"},{packCostCents:-1},{packCostCents:1.5},{ingredientId:"egg",unit:"pieces",packUnit:"pieces",quantity:1.5}])assert.throws(()=>validateBatch({...good,...patch}));
});

test("purchase pack costs persist and only owners can change costs",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-costs-"));const store=openInventoryStore(join(dir,"test.sqlite"));
 try{
  let data=store.seed("owner");const rice=data.batches.find(batch=>batch.ingredientId==="rice")!;const pack=data.packs.find(item=>item.ingredientId==="rice")!;
  data=store.save({...rice,packQuantity:pack.quantity,packUnit:pack.unit,packLabel:pack.label,packCostCents:1250},"owner");
  assert.equal(data.packs.find(item=>item.ingredientId==="rice")?.costCents,1250);
  data=store.saveWaterCost({costCents:150},"owner");
  assert.deepEqual(data.packs.find(item=>item.ingredientId==="water"),{ingredientId:"water",quantity:1,unit:"L",label:"litre",costCents:150});
  assert.throws(()=>store.saveWaterCost({costCents:150},"staff"));
  assert.throws(()=>store.saveWaterCost({costCents:1.5},"owner"));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test("staff can add stock but cannot correct existing batches or change purchase settings",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-staff-"));const store=openInventoryStore(join(dir,"test.sqlite"));
 try{const data=store.seed("owner");const batch=data.batches.find(b=>b.ingredientId==="rice")!;const pack=data.packs.find(p=>p.ingredientId==="rice")!;
 const input={...batch,packQuantity:pack.quantity,packUnit:pack.unit,packLabel:pack.label};
 assert.throws(()=>store.save(input,"staff"));
 const {id,version,...newBatch}=input;
 assert.throws(()=>store.save({...newBatch,packQuantity:25},"staff"));
 const saved=store.save(newBatch,"staff");assert.equal(saved.batches.length,data.batches.length+1);assert.ok(saved.batches.some(b=>b.updatedBy==="staff"));assert.throws(()=>store.seed("staff"));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test("baseline prices are owner-only, independent of packs and batches, persistent and atomic",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-unit-prices-"));const file=join(dir,"test.sqlite");let store=openInventoryStore(file);const raw=new Database(file);
 try{
  const seeded=store.seed("owner");
  const saved=store.savePrice({ingredientId:"rice",unit:"kg",costCents:600,version:0},"owner");
  assert.deepEqual(saved.batches,seeded.batches);
  assert.deepEqual(saved.packs,seeded.packs);
  assert.equal(saved.prices?.find(p=>p.ingredientId==="rice")?.costCents,600);
  assert.throws(()=>store.savePrice({ingredientId:"rice",unit:"kg",costCents:700,version:1},"staff"));
  for(const patch of [{costCents:-1},{costCents:1.5},{costCents:Infinity},{ingredientId:"fake"},{unit:"L"},{version:0}])assert.throws(()=>store.savePrice({ingredientId:"rice",unit:"kg",costCents:700,version:1,...patch},"owner"));
  const rice=seeded.batches.find(b=>b.ingredientId==="rice")!;
  store.save({...rice,packQuantity:25,packUnit:"kg",packLabel:"bag"},"owner");
  assert.equal(store.list().prices?.find(p=>p.ingredientId==="rice")?.costCents,600);
  raw.exec("CREATE TRIGGER fail_price_history BEFORE INSERT ON ingredient_cost_history BEGIN SELECT RAISE(ABORT,'test failure'); END");
  assert.throws(()=>store.savePrice({ingredientId:"rice",unit:"kg",costCents:700,version:1},"owner"));
  assert.equal(store.list().prices?.find(p=>p.ingredientId==="rice")?.costCents,600);
  raw.exec("DROP TRIGGER fail_price_history");store.close();store=openInventoryStore(file);
  assert.equal(store.list().prices?.find(p=>p.ingredientId==="rice")?.costCents,600);
 }finally{raw.close();store.close();rmSync(dir,{recursive:true,force:true});}
});

test("legacy pack prices convert once to baseline prices with correct recipe units",async()=>{
 const {costRecipe}=await import("../src/lib/costing");
 const dir=mkdtempSync(join(tmpdir(),"dapur-price-migration-"));const file=join(dir,"test.sqlite");let store=openInventoryStore(file);const raw=new Database(file);
 try{
  store.seed("owner");store.close();
  raw.exec("DELETE FROM schema_migrations WHERE version IN (10,11); UPDATE inventory_packs SET cost_cents=3000 WHERE ingredient_id='rice'; UPDATE inventory_packs SET cost_cents=1350 WHERE ingredient_id='egg'; UPDATE inventory_packs SET cost_cents=1500 WHERE ingredient_id='coffee'");
  store=openInventoryStore(file);let data=store.list();
  assert.equal(data.prices?.find(p=>p.ingredientId==="rice")?.costCents,600);
  assert.equal(data.prices?.find(p=>p.ingredientId==="egg")?.costCents,1350);
  assert.equal(data.prices?.find(p=>p.ingredientId==="coffee")?.costCents,3000);
  store.savePrice({ingredientId:"oil",unit:"L",costCents:600,version:0},"owner");store.savePrice({ingredientId:"water",unit:"L",costCents:0,version:0},"owner");data=store.list();
  const recipe={id:"test",name:"Test",category:"Food" as const,version:1,servings:1,lines:[{ingredientId:"rice" as const,quantity:100,unit:"g" as const},{ingredientId:"oil" as const,quantity:10,unit:"ml" as const},{ingredientId:"egg" as const,quantity:1,unit:"pieces" as const},{ingredientId:"water" as const,quantity:200,unit:"ml" as const}]};
  assert.equal(costRecipe(recipe,data.packs,data.prices).batchCostCents,111);
  store.savePrice({ingredientId:"rice",unit:"kg",costCents:700,version:1},"owner");store.close();store=openInventoryStore(file);
  assert.equal(store.list().prices?.find(p=>p.ingredientId==="rice")?.costCents,700);
 }finally{raw.close();store.close();rmSync(dir,{recursive:true,force:true});}
});

test("tea packet prices convert once, persist and cost recipes by bags used",async()=>{
 const {costRecipe}=await import("../src/lib/costing");
 const dir=mkdtempSync(join(tmpdir(),"dapur-tea-packet-"));const file=join(dir,"test.sqlite");let store=openInventoryStore(file);const raw=new Database(file);
 try{
  raw.prepare("INSERT INTO ingredient_prices (ingredient_id,unit,quantity,cost_cents,version) VALUES ('tea','pieces',1,12,1)").run();
  raw.exec("DELETE FROM schema_migrations WHERE version=12");store.close();store=openInventoryStore(file);
  let data=store.list();const tea=data.prices?.find(p=>p.ingredientId==="tea");assert.equal(tea?.quantity,100);assert.equal(tea?.costCents,1200);
  const recipe={id:"test",name:"Tea",category:"Drink" as const,version:1,servings:10,lines:[{ingredientId:"tea" as const,quantity:10,unit:"pieces" as const}]};
  assert.equal(costRecipe(recipe,data.packs,data.prices).batchCostCents,120);
  data=store.savePrice({ingredientId:"tea",unit:"pieces",quantity:100,costCents:1500,version:tea!.version},"owner");
  assert.equal(costRecipe(recipe,data.packs,data.prices).batchCostCents,150);
  assert.throws(()=>store.savePrice({ingredientId:"tea",unit:"pieces",quantity:1,costCents:12,version:tea!.version+1},"owner"));
  store.close();store=openInventoryStore(file);assert.equal(store.list().prices?.find(p=>p.ingredientId==="tea")?.costCents,1500);
 }finally{raw.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
