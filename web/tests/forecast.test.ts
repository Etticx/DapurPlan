import {test} from "node:test";import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";import {tmpdir} from "node:os";import {join} from "node:path";
import {buildForecastInputs,requestForecast} from "../src/lib/forecast";
import {emptySalesDay} from "../src/lib/sales";import {addDays} from "../src/lib/inventory";
import {openForecastStore} from "../src/lib/forecast-store";import {openSalesStore} from "../src/lib/sales-store";
test("features use target weekday, yesterday, target minus seven and seven-day mean",()=>{
 const days=Array.from({length:7},(_,i)=>({...emptySalesDay(addDays("2026-10-22",i-7)),version:1,lines:emptySalesDay("2026-10-21").lines.map(l=>({...l,quantity:i*10}))}));
 const p=buildForecastInputs("2026-10-22",days);assert.equal(p.missing.length,0);assert.deepEqual(p.inputs[0],{item:"Chicken rice",day_of_week:3,sales_yesterday:60,sales_last_week:0,average_previous_7_days:30});days[2].lines[0].quantity=null as unknown as number;assert.equal(buildForecastInputs("2026-10-22",days).missing.length,1);
});
test("invalid model responses and connection errors fail clearly",async()=>{
 await assert.rejects(()=>requestForecast([],"http://test",async()=>{throw new Error("offline");}),/unavailable/);
 await assert.rejects(()=>requestForecast([],"http://test",async()=>Response.json({predictions:[]})),/five menus/);
});
test("model response preserves whether it was trained on synthetic data",async()=>{
 const predictions=["Chicken rice","Fried kuey teow with egg","Nasi lemak with egg","Kopi O ais","Iced lemon tea"].map(item=>({item,predicted_servings:12.5}));
 const real=await requestForecast([],"http://test",async()=>Response.json({model_id:"a".repeat(64),synthetic_model:false,predictions}));
 const synthetic=await requestForecast([],"http://test",async()=>Response.json({model_id:"b".repeat(64),synthetic_model:true,predictions}));
 assert.equal(real.syntheticModel,false);
 assert.equal(synthetic.syntheticModel,true);
});
test("saved forecasts persist and reject sales changed during prediction",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-forecast-"));const path=join(dir,"test.sqlite");const sales=openSalesStore(path);let store=openForecastStore(path);
 try{const target=store.view().targetDate;for(let i=0;i<7;i++){const d=emptySalesDay(addDays(target,i-7));sales.save({...d,lines:d.lines.map(l=>({...l,quantity:40}))},"owner");}
 const p=store.prepare();const result={modelId:"a".repeat(64),syntheticModel:true,predictions:p.inputs.map((v,i)=>({menuId:String(i),item:v.item,predictedServings:40.5}))};
 store.save(p,result,"owner");assert.equal(store.view().latest!.predictions[0].predictedServings,40.5);store.close();store=openForecastStore(path);assert.equal(store.view().latest!.history.length,7);
 const changed=sales.day(addDays(target,-1));sales.save({...changed,lines:changed.lines.map(l=>({...l,quantity:20}))},"owner");assert.equal(store.view().stale,true);assert.throws(()=>store.save(p,result,"owner"),/Sales changed/);
 }finally{sales.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
