import {test} from "node:test";import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";import {tmpdir} from "node:os";import {join} from "node:path";import Database from "better-sqlite3";
import {ingredientNeeds,defaultPrep,validatePrep} from "../src/lib/planning";
import {openPlanStore} from "../src/lib/plan-store";import {openSalesStore} from "../src/lib/sales-store";import {openForecastStore} from "../src/lib/forecast-store";import {openInventoryStore} from "../src/lib/inventory-store";
import {demoRecipes} from "../src/lib/recipes";import type {StoredRecipe} from "../src/lib/recipe-store";import type {Inventory,Batch} from "../src/lib/inventory";import {emptySalesDay} from "../src/lib/sales";import {addDays,malaysiaDate} from "../src/lib/inventory";
const recipes:StoredRecipe[]=demoRecipes.map(r=>({...r,priceCents:null,version:1,updatedAt:"seed",updatedBy:"seed",isDemo:true}));
function batch(id:string,ingredientId:Batch["ingredientId"],quantity:number,unit:Batch["unit"],expiryDate:string|null,countDate="2026-10-21"):Batch{return {id,ingredientId,quantity,unit,expiryDate,countDate,version:1,isDemo:true,updatedAt:"seed",updatedBy:"seed"};}
test("combines shared rice, converts units, excludes expired stock and rounds purchase packs",()=>{
 const inventory:Inventory={batches:[batch("old","rice",2,"kg","2026-10-21"),batch("soon","rice",3000,"g","2026-10-22"),batch("later","rice",2,"kg","2026-11-01")],packs:[{ingredientId:"rice",quantity:5,unit:"kg",label:"bag"}]};
 const prep=demoRecipes.map(r=>({menuId:r.id,servings:r.id==="chicken-rice"?41:r.id==="nasi-lemak"?52:0}));
 const needs=ingredientNeeds(prep,recipes,inventory,"2026-10-22","2026-10-21");const rice=needs.find(n=>n.ingredientId==="rice")!;
 assert.ok(Math.abs(rice.required-9300)<1e-6);assert.equal(rice.available,5000);assert.ok(Math.abs(rice.shortage-4300)<1e-6);assert.equal(rice.packCount,1);assert.deepEqual(rice.allocations.map(a=>a.batchId),["soon","later"]);assert.ok(!needs.some(n=>n.ingredientId==="water"));
});
test("drinks combine sugar; missing expiry and older stock counts are flagged",()=>{
 const prep=demoRecipes.map(r=>({menuId:r.id,servings:r.id==="kopi"||r.id==="tea"?40:0}));const inventory:Inventory={batches:[batch("sugar","sugar",500,"g",null,"2026-10-20")],packs:[{ingredientId:"sugar",quantity:1,unit:"kg",label:"bag"}]};
 const sugar=ingredientNeeds(prep,recipes,inventory,"2026-10-22","2026-10-21").find(n=>n.ingredientId==="sugar")!;assert.equal(sugar.required,1400);assert.equal(sugar.shortage,900);assert.equal(sugar.packCount,1);assert.equal(sugar.warnings.length,2);
});
test("drafts and owner approvals retain snapshots, detect changes and never deduct stock",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-plan-"));const path=join(dir,"test.sqlite");const sales=openSalesStore(path);const forecasts=openForecastStore(path);const inventory=openInventoryStore(path);let plans=openPlanStore(path);const raw=new Database(path);
 try{
  const target=forecasts.view().targetDate;for(let i=0;i<7;i++){const d=emptySalesDay(addDays(target,i-7));sales.save({...d,lines:d.lines.map(l=>({...l,quantity:40}))},"owner");}
  const p=forecasts.prepare();const forecast=forecasts.save(p,{modelId:"a".repeat(64),syntheticModel:true,predictions:demoRecipes.map(r=>({menuId:r.id,item:r.name,predictedServings:40.2}))},"owner");
  const stock=inventory.seed("owner");let view=plans.view();const prep=defaultPrep(forecast);assert.ok(prep.every(p=>p.servings===41));assert.throws(()=>validatePrep([...prep.slice(1),prep[1]],forecast));
  let input={action:"save",forecastId:forecast.id,prep,basisKey:view.basisKey,expectedPlanId:0,stockReviewed:false};view=plans.save(input,"owner");assert.equal(view.saved!.status,"draft");assert.deepEqual(inventory.list(),stock);
  input={...input,action:"approve",expectedPlanId:view.saved!.id};assert.throws(()=>plans.save(input,"owner"),/Confirm/);assert.throws(()=>plans.save(input,"staff"));
  view=plans.save({...input,stockReviewed:true},"owner");assert.equal(view.saved!.status,"approved");const approved=view.saved!;assert.deepEqual(inventory.list(),stock);
  plans.close();plans=openPlanStore(path);assert.equal(plans.view().saved!.status,"approved");
  const b=stock.batches.find(b=>b.ingredientId==="rice")!;const pack=stock.packs.find(p=>p.ingredientId==="rice")!;inventory.save({...b,quantity:4,packQuantity:pack.quantity,packUnit:pack.unit,packLabel:pack.label},"owner");assert.equal(plans.view().planStale,true);assert.deepEqual(plans.latest(target),approved);assert.throws(()=>plans.save({...input,expectedPlanId:approved.id,stockReviewed:true},"owner"),/changed/);
  const current=plans.view();const before=raw.prepare("SELECT COUNT(*) AS n FROM preparation_plans").get();raw.exec("CREATE TRIGGER fail_plan BEFORE INSERT ON preparation_plans BEGIN SELECT RAISE(ABORT,'test failure'); END");assert.throws(()=>plans.save({...input,basisKey:current.basisKey,expectedPlanId:approved.id},"owner"));assert.deepEqual(raw.prepare("SELECT COUNT(*) AS n FROM preparation_plans").get(),before);
 }finally{raw.close();plans.close();sales.close();forecasts.close();inventory.close();rmSync(dir,{recursive:true,force:true});}
});
