import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import Database from "better-sqlite3";
import {openRecipeStore,RecipeConflictError} from "../src/lib/recipe-store";
import {validateRecipeUpdate} from "../src/lib/recipe-validation";
import {perServing,baseQuantity} from "../src/lib/recipes";

test("recipes persist, seed once, reject stale changes, and roll back failed history writes",()=>{
  const dir=mkdtempSync(join(tmpdir(),"dapurplan-recipes-"));
  const path=join(dir,"test.sqlite");
  let store=openRecipeStore(path);
  const external=new Database(path);
  try {
    const original=store.list()[0];
    assert.equal(store.list().length,5);
    assert.equal(store.history(original.id).length,1);
    const saved=store.update(original.id,{...original,servings:25,priceCents:1250},"owner");
    assert.equal(saved.version,2);
    assert.equal(saved.priceCents,1250);
    assert.equal(saved.updatedBy,"owner");
    const history=store.history(original.id);
    assert.equal(history[0].snapshot.servings,25);
    assert.deepEqual(history[0].snapshot.lines,original.lines);
    assert.equal(history[0].snapshot.priceCents,1250);
    assert.equal(history[1].snapshot.servings,20);
    assert.throws(()=>store.update(original.id,original,"owner"),RecipeConflictError);
    assert.throws(()=>store.update(original.id,saved,"staff"));
    store.close();store=openRecipeStore(path);
    assert.equal(store.list()[0].servings,25);
    assert.equal(store.list()[0].priceCents,1250);
    assert.equal(store.history(original.id).length,2);
    assert.equal((external.prepare("SELECT stock_tracked FROM ingredients WHERE id='water'").get() as {stock_tracked:number}).stock_tracked,0);
    external.exec("CREATE TRIGGER fail_history BEFORE INSERT ON recipe_versions BEGIN SELECT RAISE(ABORT, 'simulated failure'); END");
    assert.throws(()=>store.update(original.id,{...saved,servings:30,lines:saved.lines.slice(1)},"owner"));
    assert.deepEqual(store.list()[0],saved);
    assert.equal(store.history(original.id).length,2);
    external.exec("DROP TRIGGER fail_history");
    assert.equal(store.update(original.id,{...saved,servings:30},"owner").version,3);
  } finally {external.close();store.close();rmSync(dir,{recursive:true,force:true});}
});

test("server validation rejects invalid quantities, IDs, units, duplicate ingredients and servings",()=>{
  const valid={servings:20,priceCents:1250,version:1,lines:[{ingredientId:"rice",quantity:2,unit:"kg"}]};
  assert.deepEqual(validateRecipeUpdate(valid),valid);
  for (const value of [null,[],{}, {...valid,version:0}, {...valid,servings:0},{...valid,servings:1.5},{...valid,priceCents:-1},{...valid,priceCents:1.5},{...valid,priceCents:100000001},{...valid,lines:[]},{...valid,lines:[...valid.lines,...valid.lines]}]) assert.throws(()=>validateRecipeUpdate(value));
  for (const quantity of [0,-1,NaN,Infinity,"2",0.0001,1e10]) assert.throws(()=>validateRecipeUpdate({...valid,lines:[{...valid.lines[0],quantity}]}));
  for (const patch of [{ingredientId:"fake"},{unit:"L"},{unit:"bags"}]) assert.throws(()=>validateRecipeUpdate({...valid,lines:[{...valid.lines[0],...patch}]}));
  assert.equal(perServing(2,"kg",20),"100 g");
  assert.equal(perServing(2,"L",10),"200 ml");
  assert.equal(baseQuantity(2,"kg"),2000);
});
