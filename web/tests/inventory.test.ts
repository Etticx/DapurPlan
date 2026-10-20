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
 for(const patch of [{ingredientId:"water"},{quantity:-1},{quantity:Infinity},{unit:"L"},{countDate:"2026-02-30"},{expiryDate:"bad"},{packQuantity:0},{packUnit:"pieces"},{ingredientId:"egg",unit:"pieces",packUnit:"pieces",quantity:1.5}])assert.throws(()=>validateBatch({...good,...patch}));
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
