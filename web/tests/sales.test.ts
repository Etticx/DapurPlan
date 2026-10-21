import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";import {tmpdir} from "node:os";import {join} from "node:path";import Database from "better-sqlite3";
import {openSalesStore} from "../src/lib/sales-store";
import {openInventoryStore} from "../src/lib/inventory-store";
import {openRecipeStore} from "../src/lib/recipe-store";
import {validateSales,validateExpenses,emptySalesDay} from "../src/lib/sales";
import {addDays,malaysiaDate} from "../src/lib/inventory";
test("sales preserve blanks, persist corrections once per date and never change inventory",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-sales-"));const path=join(dir,"test.sqlite");const inventory=openInventoryStore(path);let store=openSalesStore(path);const raw=new Database(path);
 try{const stock=inventory.seed("owner");const date=malaysiaDate();const initial=store.day(date);assert.equal(initial.version,0);assert.ok(initial.lines.every(l=>l.quantity===null));
 const input={...initial,lines:initial.lines.map((l,i)=>({...l,quantity:i===0?40:i===1?0:null,soldOut:i===0}))};
 const saved=store.save(input,"owner");assert.equal(saved.day.version,1);assert.equal(saved.recent[0].entered,2);assert.equal(saved.recent[0].total,40);assert.equal(saved.day.lines[2].quantity,null);
 assert.throws(()=>store.save(input,"owner"));assert.throws(()=>store.save(saved.day,"visitor"));
 const corrected=store.save({...saved.day,lines:saved.day.lines.map((l,i)=>i===0?{...l,quantity:45}:l)},"owner");assert.equal(corrected.recent.length,1);assert.equal(corrected.recent[0].total,45);assert.equal(store.history(date).length,2);
 assert.deepEqual(inventory.list(),stock);
 store.close();store=openSalesStore(path);assert.deepEqual(store.day(date),corrected.day);
 raw.exec("CREATE TRIGGER fail_sales_history BEFORE INSERT ON sales_history BEGIN SELECT RAISE(ABORT,'test failure'); END");assert.throws(()=>store.save({...corrected.day,lines:input.lines},"owner"));assert.deepEqual(store.day(date),corrected.day);assert.equal(store.history(date).length,2);
 }finally{raw.close();store.close();inventory.close();rmSync(dir,{recursive:true,force:true});}
});
test("sales reject negative, fractional, unknown, missing, future and all-blank entries",()=>{
 const d=emptySalesDay(malaysiaDate());const good={...d,lines:d.lines.map((l,i)=>({...l,quantity:i===0?0:null}))};assert.equal(validateSales(good).lines[0].quantity,0);
 for(const input of [d,null,{...good,date:"2099-01-01"},{...good,date:"2026-02-30"},{...good,version:-1},{...good,lines:good.lines.slice(1)},{...good,lines:good.lines.map(()=>good.lines[0])}])assert.throws(()=>validateSales(input));
 for(const patch of [{quantity:-1},{quantity:1.5},{quantity:Infinity},{quantity:"40"},{menuId:"fake"},{quantity:null,soldOut:true},{soldOut:"yes"}])assert.throws(()=>validateSales({...good,lines:good.lines.map((l,i)=>i===0?{...l,...patch}:l)}));
 assert.equal(validateExpenses({date:malaysiaDate(),version:0,expenses:[{category:"Rent",amountCents:100,note:""}]}).expenses[0].amountCents,100);
 for(const expenses of [null,[{category:"x",amountCents:100,note:""}],[{category:"Rent",amountCents:0,note:""}],[{category:"Rent",amountCents:101,note:"x".repeat(121)}]])assert.throws(()=>validateExpenses({date:malaysiaDate(),version:0,expenses}));
});

test("daily revenue snapshots menu prices and compares with the previous calendar day",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-revenue-"));const path=join(dir,"test.sqlite");const store=openSalesStore(path);const recipes=openRecipeStore(path);
 try{
  const menu=recipes.list()[0];recipes.update(menu.id,{...menu,priceCents:2500},"owner");
  const previousDate=addDays(malaysiaDate(),-1);const today=malaysiaDate();
  const previous=emptySalesDay(previousDate);previous.lines[0].quantity=2;previous.lines[1].quantity=0;
  const previousSaved=store.save(previous,"owner");assert.equal(previousSaved.recent[0].revenueCents,5000);
  const current=emptySalesDay(today);current.lines[0].quantity=3;current.lines[1].quantity=0;
  const currentSaved=store.save(current,"owner");
  assert.equal(currentSaved.day.lines[0].unitPriceCents,2500);
  assert.equal(currentSaved.day.lines[0].quantity!*currentSaved.day.lines[0].unitPriceCents!,7500);
  assert.equal(currentSaved.previousDay.date,previousDate);
  assert.equal(currentSaved.previousDay.lines[0].unitPriceCents,2500);
  assert.equal(currentSaved.recent.find(day=>day.date===today)?.revenueCents,7500);
  recipes.update(recipes.list()[0].id,{...recipes.list()[0],priceCents:3000},"owner");
  const corrected=store.save({...previousSaved.day,lines:previousSaved.day.lines.map((line,i)=>i===0?{...line,quantity:4}:line)},"owner");
  assert.equal(corrected.day.lines[0].unitPriceCents,2500);
  assert.equal(corrected.recent.find(day=>day.date===previousDate)?.revenueCents,10000);
 }finally{recipes.close();store.close();rmSync(dir,{recursive:true,force:true});}
});

test("daily profit snapshots recipe costs, includes expenses, and aggregates trends",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-profit-"));const path=join(dir,"test.sqlite");const store=openSalesStore(path);const recipes=openRecipeStore(path);const inventory=openInventoryStore(path);
 try{
  let stocks=inventory.seed("owner");const rice=stocks.batches.find(batch=>batch.ingredientId==="rice")!;const pack=stocks.packs.find(item=>item.ingredientId==="rice")!;
  stocks=inventory.save({...rice,packQuantity:1,packUnit:"kg",packLabel:"bag",packCostCents:2000},"owner");
  const recipe=recipes.list()[0];recipes.update(recipe.id,{...recipe,priceCents:3000,servings:2,lines:[{ingredientId:"rice",quantity:2,unit:"kg"}]},"owner");
  const previousDate=addDays(malaysiaDate(),-1);const today=malaysiaDate();
  const previous=emptySalesDay(previousDate);previous.lines[0].quantity=1;store.save(previous,"owner");
  const current=emptySalesDay(today);current.lines[0].quantity=3;const saved=store.save(current,"owner");
  assert.equal(saved.day.lines[0].ingredientCostPerServingCents,2000);
  assert.equal(saved.day.lines[0].costSnapshot?.ingredients[0].quantity,2);
  const expenseSaved=store.saveExpenses({date:today,version:0,expenses:[{category:"Utilities",amountCents:1000,note:"Power"}]},"owner");
  assert.equal(expenseSaved.expenses[0].amountCents,1000);
  const daily=store.financial(today);
  assert.equal(daily.revenueCents,9000);assert.equal(daily.ingredientCostCents,6000);assert.equal(daily.grossProfitCents,3000);assert.equal(daily.expensesCents,1000);assert.equal(daily.netProfitCents,2000);
  recipes.update(recipe.id,{...recipes.list()[0],priceCents:5000,servings:4,lines:[{ingredientId:"rice",quantity:4,unit:"kg"}]},"owner");
  const latestRice=inventory.list().batches.find(batch=>batch.ingredientId==="rice")!;
  inventory.save({...latestRice,packQuantity:1,packUnit:"kg",packLabel:"bag",packCostCents:4000},"owner");
  const corrected=store.save({...saved.day,lines:saved.day.lines.map((line,index)=>index===0?{...line,quantity:4}:line)},"owner");
  assert.equal(corrected.day.lines[0].unitPriceCents,3000);
  assert.equal(corrected.day.lines[0].ingredientCostPerServingCents,2000);
  assert.equal(corrected.day.lines[0].costSnapshot?.batchCostCents,4000);
  assert.equal(store.financial(today).netProfitCents,3000);
  const weekday=new Date(today+"T00:00:00Z").getUTCDay();const weekStart=addDays(today,-((weekday+6)%7));
  assert.equal(store.trend("weekly",today).find(period=>period.date===weekStart)?.netProfitCents,4000);
  assert.equal(store.trend("monthly",today).find(period=>period.date===today.slice(0,7))?.netProfitCents,4000);
  assert.throws(()=>store.saveExpenses({date:today,version:0,expenses:[]},"owner"),/changed/);
 }finally{inventory.close();recipes.close();store.close();rmSync(dir,{recursive:true,force:true});}
});

test("six-day demo import preserves existing entries, provenance and manual seventh day",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-demo-"));const store=openSalesStore(join(dir,"test.sqlite"));
 try{
  const existing=emptySalesDay("2026-10-16");existing.lines[0].quantity=999;
  store.save(existing,"owner");
  const result=store.importDemo("owner");assert.equal(result.imported.length,5);assert.deepEqual(result.skipped,["2026-10-16"]);
  assert.equal(store.day("2026-10-16").lines[0].quantity,999);
  assert.equal(store.day("2026-10-15").lines[0].quantity,41);
  assert.equal(store.day("2026-10-15").provenance?.sourceDate,"2025-12-25");
  assert.equal(store.day("2026-10-20").lines[0].quantity,45);
  assert.equal(store.day("2026-10-21").version,0);
  assert.equal(store.importDemo("owner").imported.length,0);
  assert.equal(store.history("2026-10-15").length,1);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
