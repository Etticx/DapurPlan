"use client";
import {useState} from "react";
import {BarChart3,Coffee,Save,RotateCcw,UtensilsCrossed,CalendarDays} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {salesMenus,type SalesData,type SalesDay,type SaleLine} from "@/lib/sales";
import {malaysiaDate} from "@/lib/inventory";

const money=new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"});
function formatMoney(cents:number|null){return cents===null?"Price needed":money.format(cents/100);}
function revenueFor(lines:SaleLine[],fallbackPrices?:Record<string,number|null>){
 const entered=lines.filter(line=>line.quantity!==null);
 if(!entered.length)return null;
 let total=0;
 for(const line of entered){
  if(line.quantity!>0&&line.unitPriceCents===null&&(fallbackPrices?.[line.menuId]??null)===null)return null;
  total+=line.quantity!*(line.unitPriceCents??fallbackPrices?.[line.menuId]??0);
 }
 return total;
}
function servingsFor(lines:SaleLine[]){return lines.reduce((sum,line)=>sum+(line.quantity??0),0);}
function itemRevenue(line:SaleLine|undefined,fallbackPrices?:Record<string,number|null>){
 if(!line||line.quantity===null)return null;
 const price=line.unitPriceCents??fallbackPrices?.[line.menuId]??null;
 return line.quantity>0&&price===null?null:line.quantity*(price??0);
}

export function SalesEditor({initialData}:{initialData:SalesData}){
 const [data,setData]=useState(initialData);const [draft,setDraft]=useState<SalesDay>(structuredClone(initialData.day));const [dirty,setDirty]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
 const [markDemo,setMarkDemo]=useState(initialData.day.date==="2026-10-21");
 const entered=draft.lines.filter(l=>l.quantity!==null).length;const total=servingsFor(draft.lines);
 const todayRevenue=revenueFor(draft.lines,draft.version===0?data.menuPrices:undefined);
 const yesterdayRevenue=revenueFor(data.previousDay.lines);
 const revenueChange=todayRevenue!==null&&yesterdayRevenue!==null&&data.previousDay.version>0?todayRevenue-yesterdayRevenue:null;
 const servingsChange=data.previousDay.version>0?total-servingsFor(data.previousDay.lines):null;
 async function choose(date:string){
  if(!date||date===draft.date)return;
  if(dirty&&!window.confirm("Discard unsaved sales changes?"))return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch(`/api/sales?date=${encodeURIComponent(date)}`,{cache:"no-store"});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error);
   setData(result);setDraft(structuredClone(result.day));setMarkDemo(result.day.date==="2026-10-21");setDirty(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not load this date.");}
  finally{setBusy(false);}
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:draft.date,version:draft.version,lines:draft.lines,syntheticDemo:draft.date==="2026-10-21"&&markDemo})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error);
   setData(result);setDraft(structuredClone(result.day));setMarkDemo(result.day.date==="2026-10-21");setDirty(false);setMessage("Sales saved. Inventory has not changed.");
  }catch(e){setError(e instanceof Error?e.message:"Could not save sales. Please try again.");}
  finally{setBusy(false);}
 }
 return <>
  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold tracking-[0.14em] text-blue-500">A SMALL DAILY HABIT</p><h1 className="text-3xl font-semibold tracking-tight">Daily sales</h1><p className="mt-2 text-sm text-muted-foreground">Record what you sold, so tomorrow’s planning has a starting point.</p></div><div><label htmlFor="sales-date" className="mb-2 block text-xs text-muted-foreground">Sales date</label><Input id="sales-date" type="date" max={malaysiaDate()} value={draft.date} disabled={busy} onChange={e=>void choose(e.target.value)}/></div></div>
  {draft.date==="2026-10-21"&&!draft.provenance&&<div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><p>Agreed demo for 21 October: chicken rice 41; kuey teow 30; nasi lemak 50; Kopi O ais 54; iced lemon tea 36.</p><label className="flex items-center gap-2"><input type="checkbox" checked={markDemo} disabled={busy} onChange={e=>setMarkDemo(e.target.checked)}/>Label this entry as synthetic demo sales</label></div>}
  {draft.provenance&&<span className="mt-5 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-secondary-foreground">Demo data</span>}
  <p className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-secondary-foreground">Enter servings sold, not servings prepared. Blank means not entered; 0 means confirmed zero sales. Sales do not deduct from your closing inventory.</p>
  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   {[["Total sales",formatMoney(todayRevenue)],["Servings sold",total],["vs previous day",revenueChange===null?"—":`${revenueChange>=0?"+":""}${formatMoney(revenueChange)}`],["Record status",busy?"Working…":dirty?"Unsaved changes":draft.version?"Saved":"Not entered"]].map(([label,value])=><div key={label} className="rounded-2xl border border-border bg-white p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p>{label==="vs previous day"&&<p className="mt-1 text-xs text-muted-foreground">{servingsChange===null?"No previous-day record":`${servingsChange>=0?"+":""}${servingsChange} servings`}</p>}</div>)}
  </div>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-destructive">{error}</p>}{message&&<p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
  <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-white">
   <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-5"><div><h2 className="font-semibold">Revenue by menu item</h2><p className="mt-1 text-xs text-muted-foreground">Revenue = servings sold × selling price.</p></div><a href="/recipes" className="text-xs font-medium text-primary underline underline-offset-4">Set menu prices</a></div>
   <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs text-muted-foreground"><tr><th scope="col" className="px-5 py-3 font-medium">Menu item</th><th scope="col" className="px-5 py-3 font-medium">Servings</th><th scope="col" className="px-5 py-3 font-medium">Price / serving</th><th scope="col" className="px-5 py-3 font-medium">Revenue</th><th scope="col" className="px-5 py-3 font-medium">Previous day</th></tr></thead>
    <tbody className="divide-y divide-border">{salesMenus.map(menu=>{const line=draft.lines.find(item=>item.menuId===menu.id);const previous=data.previousDay.lines.find(item=>item.menuId===menu.id);const draftPrice=draft.version===0?data.menuPrices[menu.id]??null:undefined;const price=line?.unitPriceCents??draftPrice??null;const Icon=menu.category==="Food"?UtensilsCrossed:Coffee;return <tr key={menu.id}><th scope="row" className="px-5 py-4 font-medium"><span className="flex items-center gap-2"><Icon className="size-4 text-blue-500" aria-hidden="true"/>{menu.name}</span></th><td className="px-5 py-4">{line?.quantity??"—"}</td><td className="px-5 py-4">{price===null?"Not set":formatMoney(price)}</td><td className="px-5 py-4 font-medium">{line?.quantity===null||!line? "—":formatMoney(itemRevenue(line,draftPrice===undefined?undefined:{[menu.id]:draftPrice}))}</td><td className="px-5 py-4 text-muted-foreground">{data.previousDay.version?formatMoney(itemRevenue(previous)): "—"}</td></tr>})}</tbody>
   </table></div>
   {todayRevenue===null&&entered>0&&<p className="border-t border-border px-5 py-3 text-xs text-amber-800">Set a selling price for each sold item to calculate total revenue.</p>}
   <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{data.previousDay.version?`Compared with ${data.previousDay.date}.`:"No sales were saved for the previous calendar day."} Saved sales retain the price recorded for that date.</p>
  </section>
  <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
   <form onSubmit={save} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center gap-2 border-b border-border p-5"><BarChart3 className="size-5 text-blue-500" aria-hidden="true"/><h2 className="font-semibold">Sales for {draft.date}</h2></div><fieldset disabled={busy} className="min-w-0 divide-y divide-border">{salesMenus.map(m=>{const line=draft.lines.find(l=>l.menuId===m.id)!;const Icon=m.category==="Food"?UtensilsCrossed:Coffee;return <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-blue-500"><Icon className="size-5" aria-hidden="true"/></span><div><label htmlFor={`sale-${m.id}`} className="text-sm font-medium">{m.name}</label><p className="mt-1 text-xs text-muted-foreground">{line.quantity===null?"Not entered":`${line.quantity} ${m.category==="Food"?"plates":"cups"} sold`}</p></div></div><div className="flex items-center gap-4"><Input id={`sale-${m.id}`} className="w-24" type="number" min="0" max="1000000" step="1" placeholder="—" value={line.quantity??""} onChange={e=>{const value=e.target.value===""?null:Number(e.target.value);setDraft({...draft,lines:draft.lines.map(l=>l.menuId===m.id?{...l,quantity:value,soldOut:value===null?false:l.soldOut}:l)});setDirty(true);setMessage("");setError("");}}/><label className="flex items-center gap-2 text-xs text-muted-foreground"><input className="size-4 accent-blue-600" type="checkbox" checked={line.soldOut} disabled={line.quantity===null} onChange={e=>{setDraft({...draft,lines:draft.lines.map(l=>l.menuId===m.id?{...l,soldOut:e.target.checked}:l)});setDirty(true);setMessage("");}}/>Sold out<span className="sr-only">: {m.name}</span></label></div></div>})}</fieldset><p className="border-t border-border px-5 py-4 text-xs leading-5 text-muted-foreground">Sold out means sales may be lower than actual customer demand. This flag is saved for future model improvements; it does not change forecasts yet.</p><div className="flex flex-wrap justify-between gap-3 border-t border-border bg-slate-50/50 p-5"><Button type="button" variant="ghost" size="sm" disabled={busy||!dirty} onClick={()=>{setDraft(structuredClone(data.day));setDirty(false);setError("");setMessage("");}}><RotateCcw aria-hidden="true"/>Discard changes</Button><Button size="sm" disabled={busy||!dirty||entered===0}><Save aria-hidden="true"/>{busy?"Saving / loading…":"Save daily sales"}</Button></div>{draft.updatedAt&&<p className="px-5 pb-4 text-xs text-muted-foreground">Saved by {draft.updatedBy} · {new Date(draft.updatedAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}</p>}</form>
   <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center gap-2 border-b border-border p-5"><CalendarDays className="size-4 text-blue-500" aria-hidden="true"/><h2 className="font-semibold">Recent records</h2></div>{data.recent.length===0?<p className="p-5 text-sm leading-6 text-muted-foreground">No sales saved yet. Your latest 30 saved dates will appear here.</p>:<div className="divide-y divide-border">{data.recent.map(day=><button type="button" key={day.date} disabled={busy} onClick={()=>void choose(day.date)} className={`block w-full p-4 text-left hover:bg-secondary ${day.date===draft.date?"bg-background":""}`}><span className="text-sm font-medium">{day.date}</span><span className="mt-1 block text-xs text-muted-foreground">{day.entered}/5 items entered · {day.total} servings · {formatMoney(day.revenueCents)}{day.sourceDate?" · Synthetic demo":""}</span></button>)}</div>}<p className="border-t border-border p-5 text-xs leading-5 text-muted-foreground">Choose any earlier date above to view or correct it. Corrections update the same day and retain an edit history.</p></section>
  </div>
 </>;
}
