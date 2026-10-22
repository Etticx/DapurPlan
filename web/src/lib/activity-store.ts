import Database from "better-sqlite3";
import {resolve} from "node:path";
import {openPlanStore} from "./plan-store";
import {ingredients,demoRecipes} from "./recipes";
import type {ActivityFilter,ActivityEvent,ActivityResult,ActivityType} from "./activity";
const union=`
 SELECT 'sales' AS type, date||':'||version AS id,changed_by AS actor,changed_at AS at,snapshot,
 (SELECT p.snapshot FROM sales_history p WHERE p.date=h.date AND p.version<h.version ORDER BY version DESC LIMIT 1) AS previous FROM sales_history h
 UNION ALL SELECT 'expenses',date||':'||version,changed_by,changed_at,snapshot,
 (SELECT p.snapshot FROM daily_expense_history p WHERE p.date=h.date AND p.version<h.version ORDER BY version DESC LIMIT 1) FROM daily_expense_history h
 UNION ALL SELECT 'recipes',menu_id||':'||version,changed_by,changed_at,snapshot,
 (SELECT p.snapshot FROM recipe_versions p WHERE p.menu_id=h.menu_id AND p.version<h.version ORDER BY version DESC LIMIT 1) FROM recipe_versions h
 UNION ALL SELECT 'inventory',CAST(id AS TEXT),changed_by,changed_at,snapshot,
 (SELECT p.snapshot FROM inventory_history p WHERE p.batch_id=h.batch_id AND p.id<h.id ORDER BY id DESC LIMIT 1) FROM inventory_history h
 UNION ALL SELECT 'costs',CAST(id AS TEXT),changed_by,changed_at,snapshot,
 (SELECT p.snapshot FROM ingredient_cost_history p WHERE p.ingredient_id=h.ingredient_id AND p.id<h.id ORDER BY id DESC LIMIT 1) FROM ingredient_cost_history h
 UNION ALL SELECT 'forecast',CAST(id AS TEXT),created_by,created_at,snapshot,NULL FROM forecasts
 UNION ALL SELECT 'plans',CAST(id AS TEXT),created_by,created_at,snapshot,
 (SELECT p.snapshot FROM preparation_plans p WHERE p.target_date=h.target_date AND p.id<h.id ORDER BY id DESC LIMIT 1) FROM preparation_plans h`;
type RawEvent={type:ActivityType;id:string;actor:string;at:string;snapshot:string;previous:string|null};
function format(raw:RawEvent):ActivityEvent{
 const now=JSON.parse(raw.snapshot),old=raw.previous?JSON.parse(raw.previous):null;
 const changes:ActivityEvent["changes"]=[];
 function add(label:string,before:unknown,after:unknown){const a=before===undefined||before===null?"—":String(before),b=after===undefined||after===null?"—":String(after);if(a!==b)changes.push({label,before:a,after:b});}
 const menuName=(id:string)=>demoRecipes.find(r=>r.id===id)?.name||id;
 const ingredientName=(id:string)=>ingredients.find(i=>i.id===id)?.name||id;
 let title="",subject="",demo=false;
 if(raw.type==="sales"){
  title=old?"Corrected daily sales":"Recorded daily sales";subject=now.date;demo=!!now.provenance;
  for(const line of now.lines||[]){const previous=old?.lines?.find((l:{menuId:string})=>l.menuId===line.menuId);add(menuName(line.menuId),previous?previous.quantity===null?"Not entered":previous.quantity:undefined,line.quantity===null?"Not entered":line.quantity);add(`${menuName(line.menuId)} · sold out`,previous?previous.soldOut?"Yes":"No":undefined,line.soldOut?"Yes":"No");}
  for(const line of now.lines||[]){const previous=old?.lines?.find((l:{menuId:string})=>l.menuId===line.menuId);add(`${menuName(line.menuId)} · selling price / serving`,previous?.unitPriceCents===undefined?undefined:previous.unitPriceCents===null?"Not set":`RM ${(previous.unitPriceCents/100).toFixed(2)}`,line.unitPriceCents===null?"Not set":`RM ${(line.unitPriceCents/100).toFixed(2)}`);add(`${menuName(line.menuId)} · ingredient cost / serving`,previous?.ingredientCostPerServingCents===undefined?undefined:previous.ingredientCostPerServingCents===null?"Incomplete":`RM ${(previous.ingredientCostPerServingCents/100).toFixed(2)}`,line.ingredientCostPerServingCents===null?"Incomplete":`RM ${(line.ingredientCostPerServingCents/100).toFixed(2)}`);}
 }else if(raw.type==="expenses"){
  title=old?"Updated daily expenses":"Recorded daily expenses";subject=now.date;
  const before=old?.expenses||[],after=now.expenses||[];
  for(let index=0;index<Math.max(before.length,after.length);index++){
   const a=before[index],b=after[index];const label=`Expense ${index+1}`;
   add(label,a?`${a.category} · ${(a.amountCents/100).toFixed(2)} · ${a.note||"No note"}`:undefined,b?`${b.category} · ${(b.amountCents/100).toFixed(2)} · ${b.note||"No note"}`:"Removed");
  }
 }else if(raw.type==="recipes"){
  title=raw.actor.startsWith("system:")?"Created demo recipe":"Updated recipe";subject=now.name||menuName(now.id);demo=!!now.isDemo;
  add("Servings per batch",old?.servings,now.servings);
  const ids=new Set<string>([...(old?.lines||[]),...(now.lines||[])].map(l=>l.ingredientId));
  for(const id of ids){const a=old?.lines?.find((l:{ingredientId:string})=>l.ingredientId===id),b=now.lines?.find((l:{ingredientId:string})=>l.ingredientId===id);add(ingredientName(id),a?`${a.quantity} ${a.unit}`:undefined,b?`${b.quantity} ${b.unit}`:"Removed");}
 }else if(raw.type==="inventory"){
  title=old?"Corrected stock batch":"Added stock batch";subject=ingredientName(now.batch.ingredientId);demo=!!now.batch.isDemo;
  add("Remaining quantity",old?`${old.batch.quantity} ${old.batch.unit}`:undefined,`${now.batch.quantity} ${now.batch.unit}`);
  add("Closing count date",old?.batch.countDate,now.batch.countDate);add("Expiry date",old?.batch.expiryDate,now.batch.expiryDate||"Not recorded");
  add("Purchase pack",old?.pack?`${old.pack.quantity} ${old.pack.unit} / ${old.pack.label}`:undefined,`${now.pack.quantity} ${now.pack.unit} / ${now.pack.label}`);
  add("Purchase pack cost",old?.pack?.costCents===undefined?undefined:old.pack.costCents===null?"Not set":`RM ${(old.pack.costCents/100).toFixed(2)}`,now.pack.costCents===null?"Not set":`RM ${(now.pack.costCents/100).toFixed(2)}`);
 }else if(raw.type==="costs"){
  title="Updated ingredient cost";subject=ingredientName(now.ingredientId);
  add(now.quantity===30&&now.ingredientId==="egg"?"Price per carton (30 eggs)":now.ingredientId==="tea"&&now.quantity===100?"Price per bag":now.ingredientId==="tea"?"Price per tea bag":now.unit?`Price per ${now.unit}`:"Cost per litre",old?.costCents===undefined?undefined:old.costCents===null?"Not set":`RM ${(old.costCents/100).toFixed(2)}`,now.costCents===null?"Not set":`RM ${(now.costCents/100).toFixed(2)}`);
 }else if(raw.type==="forecast"){
  title="Generated serving forecast";subject=now.targetDate;demo=!!now.syntheticModel;
  for(const p of now.predictions||[])add(p.item,undefined,`${Number(p.predictedServings.toFixed(3))} servings`);
 }else{
  title=now.status==="approved"?"Approved preparation plan":"Saved preparation draft";subject=now.targetDate;demo=!!now.sources?.forecast?.syntheticModel;
  add("Plan status",old?.status,now.status);
  for(const p of now.prep||[])add(menuName(p.menuId),old?.prep?.find((l:{menuId:string})=>l.menuId===p.menuId)?.servings,p.servings);
  const before=old?.needs?.filter((n:{shortage:number})=>n.shortage>0).length;add("Ingredients to buy",before,now.needs?.filter((n:{shortage:number})=>n.shortage>0).length);
  if(now.status==="approved")add("Stock and expiry reviewed",undefined,now.stockReviewed?"Confirmed":"Not recorded");
 }
 if(!changes.length)changes.push({label:"Record saved",before:"Same values",after:"No quantity changes"});
 return {id:`${raw.type}:${raw.id}`,type:raw.type,actor:raw.actor,at:raw.at,title,subject,demo,changes};
}
export function openActivityStore(filename=process.env.DAPURPLAN_DB_PATH||resolve(process.cwd(),"data/dapurplan.sqlite")){
 const setup=openPlanStore(filename);setup.close();const db=new Database(filename,{readonly:true});db.pragma("busy_timeout = 5000");
 function list(filter:ActivityFilter,viewer:{username:string;role:"owner"|"staff"}):ActivityResult{
  const where:string[]=[];const values:(string|number)[]=[];
  if(viewer.role==="staff"){where.push("actor = ?");values.push(viewer.username);}
  else if(filter.actor){where.push(filter.actor==="system"?"actor LIKE ?":"actor = ?");values.push(filter.actor==="system"?"system:%":filter.actor);}
  if(filter.type){where.push("type = ?");values.push(filter.type);}
  // Filters are action dates in Malaysia time, not the date the sales/plan is for.
  if(filter.from){where.push("date(at, '+8 hours') >= ?");values.push(filter.from);}
  if(filter.to){where.push("date(at, '+8 hours') <= ?");values.push(filter.to);}
  const condition=where.length?" WHERE "+where.join(" AND "):"";
  return db.transaction(()=>{const total=(db.prepare(`SELECT COUNT(*) AS n FROM (${union})${condition}`).get(...values) as {n:number}).n;
   const rows=db.prepare(`SELECT * FROM (${union})${condition} ORDER BY at DESC,type ASC,id DESC LIMIT 20 OFFSET ?`).all(...values,(filter.page-1)*20) as RawEvent[];
   return {total,page:filter.page,pageSize:20,events:rows.map(format)};
  })();
 }
 return {list,close:()=>db.close()};
}
