import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";import {tmpdir} from "node:os";import {join} from "node:path";import Database from "better-sqlite3";
import {openSalesStore} from "../src/lib/sales-store";
import {openInventoryStore} from "../src/lib/inventory-store";
import {openRecipeStore} from "../src/lib/recipe-store";
import {validateSales,validateExpenses,emptySalesDay,salesMenus} from "../src/lib/sales";
import {addDays,malaysiaDate} from "../src/lib/inventory";
import {calculateProfitTotals,calculateSaleFinancialTotals,calculateSaleLineFinancials} from "../src/lib/sales-financials";

test("financial calculations use integer cents, sold servings and explicit unavailable states",()=>{
 const lines=[
  {menuId:"priced",quantity:3,unitPriceCents:2500,ingredientCostPerServingCents:2000},
  {menuId:"negative",quantity:2,unitPriceCents:1000,ingredientCostPerServingCents:1500},
  {menuId:"zero",quantity:0,unitPriceCents:null,ingredientCostPerServingCents:null},
 ];
 assert.deepEqual(calculateSaleLineFinancials(lines[0]),{menuId:"priced",revenueCents:7500,ingredientCostCents:6000,contributionCents:1500,contributionMarginPercent:20});
 assert.deepEqual(calculateSaleLineFinancials(lines[1]),{menuId:"negative",revenueCents:2000,ingredientCostCents:3000,contributionCents:-1000,contributionMarginPercent:-50});
 assert.deepEqual(calculateSaleLineFinancials(lines[2]),{menuId:"zero",revenueCents:0,ingredientCostCents:0,contributionCents:0,contributionMarginPercent:null});
 assert.deepEqual(calculateSaleFinancialTotals(lines),{revenueCents:9500,ingredientCostCents:9000});
 assert.deepEqual(calculateSaleFinancialTotals([{menuId:"missing-price",quantity:1,unitPriceCents:null,ingredientCostPerServingCents:0}]),{revenueCents:null,ingredientCostCents:0});
 assert.deepEqual(calculateSaleFinancialTotals([{menuId:"missing-cost",quantity:1,unitPriceCents:0,ingredientCostPerServingCents:null}]),{revenueCents:0,ingredientCostCents:null});
 assert.deepEqual(calculateSaleFinancialTotals([{menuId:"not-entered",quantity:null,unitPriceCents:null,ingredientCostPerServingCents:null}]),{revenueCents:null,ingredientCostCents:null});
 const incomplete=calculateProfitTotals({date:"2026-01-01",revenueCents:9500,ingredientCostCents:9000,expensesCents:0,expensesRecorded:false,salesDays:1});
 assert.equal(incomplete.grossProfitCents,500);assert.equal(incomplete.netProfitCents,null);assert.equal(incomplete.grossProfitMarginPercent,500/9500*100);
 const complete=calculateProfitTotals({date:"2026-01-01",revenueCents:9500,ingredientCostCents:9000,expensesCents:1000,expensesRecorded:true,salesDays:1});
 assert.equal(complete.netProfitCents,-500);assert.equal(complete.netProfitMarginPercent,-500/9500*100);
 const noRevenue=calculateProfitTotals({date:"2026-01-01",revenueCents:0,ingredientCostCents:0,expensesCents:0,expensesRecorded:true,salesDays:1});
 assert.equal(noRevenue.grossProfitMarginPercent,null);assert.equal(noRevenue.netProfitMarginPercent,null);
 const overflow=calculateProfitTotals({date:"2026-01-01",revenueCents:0,ingredientCostCents:Number.MAX_SAFE_INTEGER,expensesCents:Number.MAX_SAFE_INTEGER,expensesRecorded:true,salesDays:1});
 assert.equal(overflow.grossProfitCents,-Number.MAX_SAFE_INTEGER);assert.equal(overflow.netProfitCents,null);
});
test("sales preserve blanks, persist corrections once per date and never change inventory",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-sales-"));const path=join(dir,"test.sqlite");const inventory=openInventoryStore(path);let store=openSalesStore(path);const raw=new Database(path);
 try{const stock=inventory.seed("owner");const date=malaysiaDate();const initial=store.day(date);assert.equal(initial.version,0);assert.ok(initial.lines.every(l=>l.quantity===null));
 const input={...initial,lines:initial.lines.map((l,i)=>({...l,quantity:i===0?40:i===1?0:null,soldOut:i===0}))};
 const saved=store.save(input,"owner");assert.equal(saved.day.version,1);assert.equal(saved.recent[0].entered,2);assert.equal(saved.recent[0].total,40);assert.equal(saved.day.lines[2].quantity,null);
 assert.throws(()=>store.save(input,"owner"));assert.equal(store.history(date).length,1);assert.throws(()=>store.save(saved.day,"visitor"));
 const corrected=store.save({...saved.day,lines:saved.day.lines.map((l,i)=>i===0?{...l,quantity:45}:l)},"owner");assert.equal(corrected.recent.length,1);assert.equal(corrected.recent[0].total,45);assert.equal(store.history(date).length,2);
 raw.pragma("foreign_keys = ON");
 const constrainedDate=addDays(date,-1);raw.prepare("INSERT INTO sales_days VALUES (?,?,?,?)").run(constrainedDate,1,"owner",new Date().toISOString());
 assert.throws(()=>raw.prepare("INSERT INTO sales_lines (date,menu_id,quantity,sold_out,unit_price_cents,ingredient_cost_per_serving_cents,cost_snapshot) VALUES (?,?,?,?,?,?,?)").run(constrainedDate,"invalid-menu",1,0,null,null,null));
 assert.throws(()=>raw.prepare("INSERT INTO sales_lines (date,menu_id,quantity,sold_out,unit_price_cents,ingredient_cost_per_serving_cents,cost_snapshot) VALUES (?,?,?,?,?,?,?)").run(constrainedDate,salesMenus[0].id,1000001,0,null,null,null));
 assert.deepEqual(inventory.list(),stock);
 store.close();store=openSalesStore(path);assert.deepEqual(store.day(date),corrected.day);
 raw.exec("CREATE TRIGGER fail_sales_history BEFORE INSERT ON sales_history BEGIN SELECT RAISE(ABORT,'test failure'); END");assert.throws(()=>store.save({...corrected.day,lines:input.lines},"owner"));assert.deepEqual(store.day(date),corrected.day);assert.equal(store.history(date).length,2);
 }finally{raw.close();store.close();inventory.close();rmSync(dir,{recursive:true,force:true});}
});
test("restoring a sales version creates an auditable version and preserves its saved financial snapshots",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-sales-restore-"));const path=join(dir,"test.sqlite");const inventory=openInventoryStore(path);let store=openSalesStore(path);
 try{
  inventory.seed("owner");
  const date=malaysiaDate();const initial=store.day(date);
  const first=store.save({...initial,lines:initial.lines.map((line,index)=>({...line,quantity:index===0?3:null}))},"owner");
  const firstLine=first.day.lines[0];
  const second=store.save({...first.day,lines:first.day.lines.map((line,index)=>index===0?{...line,quantity:8}:line)},"staff");
  const restored=store.restore({date,expectedVersion:second.day.version,version:first.day.version},"staff");
  assert.equal(restored.day.version,3);assert.equal(restored.day.lines[0].quantity,3);
  assert.equal(restored.day.lines[0].unitPriceCents,firstLine.unitPriceCents);
  assert.equal(restored.day.lines[0].ingredientCostPerServingCents,firstLine.ingredientCostPerServingCents);
  assert.deepEqual(restored.day.lines[0].costSnapshot,firstLine.costSnapshot);
  assert.deepEqual(restored.history.map(version=>version.version),[3,2,1]);
  assert.equal(restored.history[0].restoredFromVersion,1);
  assert.equal(restored.history[1].day.lines[0].quantity,8);
  assert.equal(restored.history[0].changedBy,"staff");assert.ok(restored.history.every(version=>Number.isFinite(Date.parse(version.changedAt))));
  assert.throws(()=>store.restore({date,expectedVersion:second.day.version,version:first.day.version},"owner"),/changed/i);
  store.close();store=openSalesStore(path);
  assert.equal(store.day(date).version,3);assert.equal(store.history(date)[2].day.lines[0].quantity,3);
 }finally{store.close();inventory.close();rmSync(dir,{recursive:true,force:true});}
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
  const current=emptySalesDay(today);current.lines[0].quantity=3;current.lines[0].unitPriceCents=1;current.lines[0].ingredientCostPerServingCents=1;current.lines[1].quantity=0;
  const currentSaved=store.save(current,"owner");
  assert.equal(currentSaved.day.lines[0].unitPriceCents,2500);
  assert.notEqual(currentSaved.day.lines[0].ingredientCostPerServingCents,1);
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
  stocks=inventory.savePrice({ingredientId:"rice",unit:"kg",costCents:2000,version:0},"owner");
  const recipe=recipes.list()[0];recipes.update(recipe.id,{...recipe,priceCents:3000,servings:2,lines:[{ingredientId:"rice",quantity:2,unit:"kg"}]},"owner");
  const previousDate=addDays(malaysiaDate(),-1);const today=malaysiaDate();
  const previous=emptySalesDay(previousDate);previous.lines[0].quantity=1;store.save(previous,"owner");
  assert.equal(store.financial(previousDate).expensesRecorded,false);assert.equal(store.financial(previousDate).netProfitCents,null);
  store.saveExpenses({date:previousDate,version:0,expenses:[]},"owner");
  const current=emptySalesDay(today);current.lines[0].quantity=3;const saved=store.save(current,"owner");
  assert.equal(saved.day.lines[0].ingredientCostPerServingCents,2000);
  assert.equal(saved.day.lines[0].costSnapshot?.ingredients[0].quantity,2);
  const beforeExpenses=store.financial(today);assert.equal(beforeExpenses.expensesRecorded,false);assert.equal(beforeExpenses.netProfitCents,null);
  const weekBeforeExpenses=store.trend("weekly",today).find(period=>period.date===addDays(today,-((new Date(today+"T00:00:00Z").getUTCDay()+6)%7)))!;
  assert.equal(weekBeforeExpenses.expensesRecorded,false);assert.equal(weekBeforeExpenses.netProfitCents,null);
  const expenseSaved=store.saveExpenses({date:today,version:0,expenses:[{category:"Utilities",amountCents:1000,note:"Power"}]},"owner");
  assert.equal(expenseSaved.expenses[0].amountCents,1000);
  const daily=store.financial(today);
  assert.equal(daily.revenueCents,9000);assert.equal(daily.ingredientCostCents,6000);assert.equal(daily.grossProfitCents,3000);assert.equal(daily.expensesCents,1000);assert.equal(daily.netProfitCents,2000);
  assert.equal(store.trend("weekly",today).find(period=>period.date===addDays(today,-((new Date(today+"T00:00:00Z").getUTCDay()+6)%7)))?.expensesRecorded,true);
  recipes.update(recipe.id,{...recipes.list()[0],priceCents:5000,servings:4,lines:[{ingredientId:"rice",quantity:4,unit:"kg"}]},"owner");
  const latestRice=inventory.list().batches.find(batch=>batch.ingredientId==="rice")!;
  inventory.savePrice({ingredientId:"rice",unit:"kg",costCents:4000,version:1},"owner");
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

test("daily expenses can be added, corrected and removed with versioned history",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-expense-lifecycle-"));const path=join(dir,"test.sqlite");const store=openSalesStore(path);const raw=new Database(path);
 try{
  const date=malaysiaDate();
  const added=store.saveExpenses({date,version:0,expenses:[{category:"Utilities",amountCents:1250,note:"Water bill"}]},"owner");
  assert.equal(added.expenseVersion,1);assert.equal(added.expenses.length,1);assert.equal(added.expenses[0].amountCents,1250);
  assert.equal(added.trend.at(-1)?.expensesCents,1250);
  const corrected=store.saveExpenses({date,version:1,expenses:[{category:"Utilities",amountCents:1500,note:"Updated bill"}]},"owner");
  assert.equal(corrected.expenseVersion,2);assert.equal(corrected.expenses[0].amountCents,1500);assert.equal(corrected.expenses[0].note,"Updated bill");
  assert.throws(()=>store.saveExpenses({date,version:1,expenses:[]},"owner"),/changed/);
  const removed=store.saveExpenses({date,version:2,expenses:[]},"owner");
  assert.equal(removed.expenseVersion,3);assert.deepEqual(removed.expenses,[]);assert.equal(removed.trend.at(-1)?.expensesCents,0);
  const history=raw.prepare("SELECT version FROM daily_expense_history WHERE date=? ORDER BY version").all(date) as {version:number}[];
  assert.deepEqual(history.map(row=>row.version),[1,2,3]);
  raw.exec("CREATE TRIGGER fail_expense_history BEFORE INSERT ON daily_expense_history BEGIN SELECT RAISE(ABORT,'test failure'); END");
  assert.throws(()=>store.saveExpenses({date,version:3,expenses:[{category:"Rent",amountCents:2500,note:"New amount"}]},"owner"));
  assert.equal(store.expenseState(date).expenseVersion,3);assert.deepEqual(store.expenseState(date).expenses,[]);
 }finally{raw.close();store.close();rmSync(dir,{recursive:true,force:true});}
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

test("owner fills missing financial snapshots without changing sales or existing costs",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-fill-financials-"));const path=join(dir,"test.sqlite");const store=openSalesStore(path);const recipes=openRecipeStore(path);const inventory=openInventoryStore(path);const raw=new Database(path);
 try{
  const first=recipes.list()[0];recipes.update(first.id,{...first,lines:[{ingredientId:"rice",quantity:100,unit:"g"}],servings:1},"owner");
  const input=emptySalesDay(malaysiaDate());input.lines[0].quantity=43;const old=store.save(input,"owner").day;const stock=inventory.list();
  assert.throws(()=>store.fillMissingFinancials({date:old.date,version:old.version},"staff"));
  assert.throws(()=>store.fillMissingFinancials({date:old.date,version:old.version},"owner"),/price|cost/i);
  assert.deepEqual(store.day(old.date),old);
  recipes.update(first.id,{...recipes.list()[0],priceCents:800},"owner");inventory.savePrice({ingredientId:"rice",unit:"kg",costCents:600,version:0},"owner");
  raw.exec("CREATE TRIGGER fail_fill_history BEFORE INSERT ON sales_history BEGIN SELECT RAISE(ABORT,'test failure'); END");
  assert.throws(()=>store.fillMissingFinancials({date:old.date,version:old.version},"owner"));assert.deepEqual(store.day(old.date),old);raw.exec("DROP TRIGGER fail_fill_history");
  const saved=store.fillMissingFinancials({date:old.date,version:old.version},"owner");
  assert.equal(saved.day.lines[0].quantity,43);assert.equal(saved.day.lines[0].unitPriceCents,800);assert.equal(saved.day.lines[0].ingredientCostPerServingCents,60);
  assert.equal(store.financial(old.date).revenueCents,34400);assert.equal(store.financial(old.date).ingredientCostCents,2580);assert.equal(store.financial(old.date).grossProfitCents,31820);
  assert.deepEqual(inventory.list().batches,stock.batches);assert.equal(store.history(old.date).length,2);
  assert.throws(()=>store.fillMissingFinancials({date:old.date,version:old.version},"owner"),/changed/i);
  recipes.update(first.id,{...recipes.list()[0],priceCents:1000},"owner");inventory.savePrice({ingredientId:"rice",unit:"kg",costCents:900,version:1},"owner");
  const again=store.fillMissingFinancials({date:old.date,version:saved.day.version},"owner");assert.deepEqual(again.day,saved.day);assert.equal(store.history(old.date).length,2);
 }finally{raw.close();store.close();recipes.close();inventory.close();rmSync(dir,{recursive:true,force:true});}
});
