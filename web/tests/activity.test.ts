import {test} from "node:test";import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";import {tmpdir} from "node:os";import {join} from "node:path";import Database from "better-sqlite3";
import {openActivityStore} from "../src/lib/activity-store";import {activityFilter} from "../src/lib/activity";
import {openPlanStore} from "../src/lib/plan-store";import {openForecastStore} from "../src/lib/forecast-store";import {openInventoryStore} from "../src/lib/inventory-store";import {openSalesStore} from "../src/lib/sales-store";
import {emptySalesDay} from "../src/lib/sales";import {addDays} from "../src/lib/inventory";import {defaultPrep} from "../src/lib/planning";import {demoRecipes} from "../src/lib/recipes";
const owner={username:"owner",role:"owner" as const};const staff={username:"staff",role:"staff" as const};
test("activity aggregates histories, shows changes, paginates and enforces staff scope",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-activity-"));const file=join(dir,"test.sqlite");const sales=openSalesStore(file);const forecasts=openForecastStore(file);const inventory=openInventoryStore(file);const plans=openPlanStore(file);let activity:ReturnType<typeof openActivityStore>|undefined;const raw=new Database(file);
 try{
  inventory.seed("owner");const target=forecasts.view().targetDate;
  for(let i=0;i<7;i++){const d=emptySalesDay(addDays(target,i-7));sales.save({...d,lines:d.lines.map(l=>({...l,quantity:40}))},"owner");}
  let day=sales.day(addDays(target,-1));sales.save({...day,lines:day.lines.map(l=>({...l,quantity:42}))},"staff");
  const prep=forecasts.prepare();const forecast=forecasts.save(prep,{modelId:"a".repeat(64),syntheticModel:true,predictions:demoRecipes.map(r=>({menuId:r.id,item:r.name,predictedServings:40.5}))},"owner");
  const view=plans.view();plans.save({action:"approve",prep:defaultPrep(forecast),forecastId:forecast.id,basisKey:view.basisKey,expectedPlanId:0,stockReviewed:true},"owner");
  activity=openActivityStore(file);const all=activityFilter(new URLSearchParams());const first=activity.list(all,owner);assert.equal(first.events.length,20);assert.ok(first.total>20);
  const next=activity.list({...all,page:2},owner);assert.ok(next.events.every(e=>!first.events.some(f=>f.id===e.id)));
  for(const type of ["sales","recipes","inventory","forecast","plans"]){const data=activity.list({...all,type},owner);assert.ok(data.total>0,type);assert.ok(data.events.every(e=>e.type===type));}
  const mine=activity.list({...all,actor:"owner"},staff);assert.equal(mine.total,1);assert.ok(mine.events.every(e=>e.actor==="staff"));assert.equal(mine.events[0].title,"Corrected daily sales");assert.ok(mine.events[0].changes.some(c=>c.before==="40"&&c.after==="42"));
  assert.ok(activity.list({...all,actor:"system"},owner).events.every(e=>e.actor.startsWith("system:")));
  raw.prepare("UPDATE sales_history SET changed_at='2020-01-01T16:30:00.000Z' WHERE changed_by='staff'").run();
  assert.equal(activity.list({...all,from:"2020-01-02",to:"2020-01-02"},owner).total,1);assert.equal(activity.list({...all,from:"2020-01-01",to:"2020-01-01"},owner).total,0);
  assert.equal(activity.list({...all,type:"sales"},owner).total,8);assert.equal(sales.day(day.date).lines[0].quantity,42);
 }finally{activity?.close();raw.close();plans.close();sales.close();forecasts.close();inventory.close();rmSync(dir,{recursive:true,force:true});}
});
test("activity filters reject invalid ranges, people, types and page values",()=>{
 for(const params of ["from=2026-02-30","from=2026-10-22&to=2026-10-21","actor=unknown","type=oops","page=0","page=1.5","type=sales%27%20OR%201%3D1"]){assert.throws(()=>activityFilter(new URLSearchParams(params)));}
});
