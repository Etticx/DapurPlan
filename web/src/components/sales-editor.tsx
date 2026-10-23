"use client";

import {useState} from "react";
import {CalendarDays,ChevronDown,Coffee,Plus,RotateCcw,Save,Trash2,TrendingUp,UtensilsCrossed} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {salesMenus,type SalesData,type SalesDay,type SaleLine,type SalesTrendPeriod,type DailyExpense} from "@/lib/sales";
import {malaysiaDate} from "@/lib/inventory";
import {MAX_SALES_SERVINGS,parseExpenseAmount,parseServingsInput} from "@/lib/sales-input";

type ExpenseDraft={id:string;category:string;amount:string;note:string};
const money=new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"});
function formatMoney(cents:number|null){return cents===null?"Not available":money.format(cents/100);}
function revenueFor(lines:SaleLine[],fallbackPrices?:Record<string,number|null>){
 const entered=lines.filter(line=>line.quantity!==null);if(!entered.length)return null;
 let total=0;
 for(const line of entered){if(line.quantity!>0&&line.unitPriceCents===null&&(fallbackPrices?.[line.menuId]??null)===null)return null;total+=line.quantity!*(line.unitPriceCents??fallbackPrices?.[line.menuId]??0);}
 return total;
}
function servingsFor(lines:SaleLine[]){return lines.reduce((sum,line)=>sum+(line.quantity??0),0);}
function lineIngredientCost(line:SaleLine,fallbackCosts?:SalesData["menuCosts"]){
 return line.ingredientCostPerServingCents??fallbackCosts?.[line.menuId]?.perServingCostCents??null;
}
function ingredientCostFor(lines:SaleLine[],fallbackCosts?:SalesData["menuCosts"]){
 const entered=lines.filter(line=>line.quantity!==null);if(!entered.length)return null;
 let total=0;
 for(const line of entered){const perServing=lineIngredientCost(line,fallbackCosts);if(line.quantity!>0&&perServing===null)return null;total+=line.quantity!*(perServing??0);}
 return total;
}
function itemRevenue(line:SaleLine|undefined,fallbackPrices?:Record<string,number|null>){
 if(!line||line.quantity===null)return null;const price=line.unitPriceCents??fallbackPrices?.[line.menuId]??null;
 return line.quantity>0&&price===null?null:line.quantity*(price??0);
}
function initialExpenses(expenses:DailyExpense[]):ExpenseDraft[]{return expenses.map(expense=>({id:expense.id,category:expense.category,amount:(expense.amountCents/100).toFixed(2),note:expense.note}));}
function summaryValue(value:number|null){return value===null?"Not available":money.format(value/100);}
function shortDate(value:string){return new Date(`${value}T12:00:00+08:00`).toLocaleDateString("en-MY",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kuala_Lumpur"});}

export function SalesEditor({initialData,canManage=false}:{initialData:SalesData;canManage?:boolean}){
 const [data,setData]=useState(initialData);
 const [draft,setDraft]=useState<SalesDay>(structuredClone(initialData.day));
 const [expensesDraft,setExpensesDraft]=useState<ExpenseDraft[]>(initialExpenses(initialData.expenses));
 const [expensesDirty,setExpensesDirty]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [trendPeriod,setTrendPeriod]=useState<SalesTrendPeriod>(initialData.trendPeriod);

 const entered=draft.lines.filter(line=>line.quantity!==null).length;
 const total=servingsFor(draft.lines);
 const isNew=draft.version===0;
 const fallbackPrices=isNew?data.menuPrices:undefined;
 const fallbackCosts=isNew?data.menuCosts:undefined;
 const totalRevenue=revenueFor(draft.lines,fallbackPrices);
 const ingredientCosts=ingredientCostFor(draft.lines,fallbackCosts);
 const grossProfit=totalRevenue===null||ingredientCosts===null?null:totalRevenue-ingredientCosts;
 const expenseTotal=expensesDraft.reduce((sum,expense)=>sum+(parseExpenseAmount(expense.amount)??0),0);
 const netProfit=grossProfit===null?null:grossProfit-expenseTotal;
 const previousRevenue=data.previousDay.version?revenueFor(data.previousDay.lines):null;
 const revenueChange=totalRevenue!==null&&previousRevenue!==null?totalRevenue-previousRevenue:null;
 const servingsChange=data.previousDay.version?total-servingsFor(data.previousDay.lines):null;

 async function load(date:string,period=trendPeriod){
  const response=await fetch(`/api/sales?date=${encodeURIComponent(date)}&trend=${period}`,{cache:"no-store"});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Could not load sales.");
  return result as SalesData;
 }
 async function choose(date:string){
  if(!date||date===draft.date)return;
  if((dirty||expensesDirty)&&!window.confirm("Discard unsaved sales or expense changes?"))return;
  setBusy(true);setError("");setMessage("");
  try{
   const result=await load(date);
   setData(result);setDraft(structuredClone(result.day));setExpensesDraft(initialExpenses(result.expenses));
   setDirty(false);setExpensesDirty(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not load this date.");}
  finally{setBusy(false);}
 }
 async function saveSales(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:draft.date,version:draft.version,lines:draft.lines,trendPeriod})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Could not save sales.");
   setData(result);setDraft(structuredClone(result.day));setDirty(false);
   setMessage("Daily sales saved. Your saved prices and costs are kept with this date.");
  }catch(e){setError(e instanceof Error?e.message:"Could not save sales. Please try again.");}
  finally{setBusy(false);}
 }
 async function fillMissingFinancials(){
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/sales/financials",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:draft.date,version:draft.version,trendPeriod})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Could not fill missing prices and costs.");
   setData(result);setDraft(structuredClone(result.day));
   setMessage("Missing values filled using current prices and recipe costs. Previously saved values were preserved.");
  }catch(e){setError(e instanceof Error?e.message:"Could not fill missing prices and costs.");}
  finally{setBusy(false);}
 }
 async function saveExpenses(e:React.FormEvent){
  e.preventDefault();setError("");setMessage("");
  const expenses=expensesDraft.map(expense=>({category:expense.category,amountCents:parseExpenseAmount(expense.amount),note:expense.note}));
  if(expenses.some(expense=>expense.amountCents===null)){
   setError("Enter an expense from RM 0.01 to RM 1,000,000.00, with up to 2 decimal places.");return;
  }
  setBusy(true);
  try{
   const response=await fetch("/api/sales/expenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:draft.date,version:data.expenseVersion,expenses,trendPeriod})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Could not save expenses.");
   setData(result);setExpensesDraft(initialExpenses(result.expenses));setExpensesDirty(false);
   setMessage("Expenses saved and included in the profit estimate.");
  }catch(e){setError(e instanceof Error?e.message:"Could not save expenses. Please try again.");}
  finally{setBusy(false);}
 }
 async function changeTrend(period:SalesTrendPeriod){
  if(period===trendPeriod)return;
  setBusy(true);setError("");
  try{const result=await load(draft.date,period);setData(result);setTrendPeriod(period);}
  catch(e){setError(e instanceof Error?e.message:"Could not load this trend.");}
  finally{setBusy(false);}
 }
 function updateLine(menuId:string,patch:Partial<SaleLine>){
  setDraft(current=>({...current,lines:current.lines.map(line=>line.menuId===menuId?{...line,...patch}:line)}));
  setDirty(true);setMessage("");setError("");
 }
 function editExpense(id:string,patch:Partial<ExpenseDraft>){
  setExpensesDraft(previous=>previous.map(expense=>expense.id===id?{...expense,...patch}:expense));
  setExpensesDirty(true);setMessage("");
 }

 return <div className="mx-auto max-w-6xl">
  <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
   <div>
    <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-blue-600">SALES REGISTER</p>
    <h1 className="text-3xl font-semibold tracking-tight">Daily sales</h1>
    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Record servings sold for each menu item. Your sales, revenue, and saved history update together.</p>
   </div>
   <label htmlFor="sales-date" className="block w-full text-sm font-medium sm:w-56">
    Sales date
    <span className="relative mt-2 block">
     <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"/>
     <Input id="sales-date" className="pl-10" type="date" max={malaysiaDate()} value={draft.date} disabled={busy} onChange={event=>void choose(event.target.value)}/>
    </span>
   </label>
  </header>

  <section aria-label="Today at a glance" className="mt-6 grid gap-3 sm:grid-cols-3">
   <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
    <p className="text-sm text-muted-foreground">Servings sold</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{total}</p>
    <p className="mt-1 text-xs text-muted-foreground">{entered} of {salesMenus.length} menu items entered</p>
   </article>
   <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
    <p className="text-sm text-muted-foreground">Sales revenue</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{summaryValue(totalRevenue)}</p>
    <p className="mt-1 text-xs text-muted-foreground">Based on servings and saved menu prices</p>
   </article>
   <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
    <p className="text-sm text-muted-foreground">Compared with previous day</p>
    <p className={`mt-2 text-2xl font-semibold tabular-nums ${revenueChange===null?"text-foreground":revenueChange>=0?"text-emerald-700":"text-rose-700"}`}>
     {revenueChange===null?"—":`${revenueChange>=0?"+":"−"}${money.format(Math.abs(revenueChange)/100)}`}
    </p>
    <p className="mt-1 text-xs text-muted-foreground">{data.previousDay.version?`${servingsChange!>=0?"+":""}${servingsChange} servings · ${shortDate(data.previousDay.date)}`:"No previous-day sales recorded"}</p>
   </article>
  </section>

  {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-destructive">{error}</p>}
  {message&&<p role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}
  {draft.provenance&&<p className="mt-4 inline-flex rounded-full border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground">Imported historical record · {draft.provenance.sourceDate}</p>}

  <form onSubmit={saveSales} className="mt-6 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
   <div className="flex flex-col gap-2 border-b border-border px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <div>
     <h2 className="text-lg font-semibold">Enter today’s sales</h2>
     <p className="mt-1 text-sm text-muted-foreground">How many servings of each item did you sell?</p>
    </div>
    <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${dirty?"bg-amber-50 text-amber-800":draft.version?"bg-emerald-50 text-emerald-800":"bg-slate-100 text-slate-600"}`}>
     {busy?"Saving…":dirty?"Unsaved changes":draft.version?"Saved":"Not entered"}
    </span>
   </div>

   <div className="divide-y divide-border">
    {salesMenus.map(menu=>{
     const line=draft.lines.find(item=>item.menuId===menu.id)!;
     const price=line.unitPriceCents??fallbackPrices?.[menu.id]??null;
     const rowRevenue=itemRevenue(line,fallbackPrices);
     const Icon=menu.category==="Food"?UtensilsCrossed:Coffee;
     return <div key={menu.id} className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_144px_130px] sm:items-center sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
       <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={18} aria-hidden="true"/></span>
       <div className="min-w-0">
        <label htmlFor={`sale-${menu.id}`} className="block text-sm font-semibold">{menu.name}</label>
        <p className="mt-1 text-xs text-muted-foreground">{price===null?"Selling price not set":`${money.format(price/100)} per serving`}</p>
       </div>
      </div>
      <label htmlFor={`sale-${menu.id}`} className="block text-xs font-medium text-muted-foreground">
       Servings sold
       <div className="mt-1.5 flex h-12 items-stretch overflow-hidden rounded-lg border border-input bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <button type="button" aria-label={`Decrease ${menu.name} servings`} disabled={busy||line.quantity===null||line.quantity===0} className="grid w-12 shrink-0 place-items-center border-r border-border text-lg font-medium text-slate-600 transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-slate-300" onClick={()=>updateLine(menu.id,{quantity:Math.max(0,(line.quantity??1)-1)})}>−</button>
        <Input id={`sale-${menu.id}`} className="h-full min-w-0 rounded-none border-0 px-1 text-center text-lg font-semibold tabular-nums shadow-none focus-visible:border-0 focus-visible:ring-0" type="text" pattern="[0-9]*" maxLength={7} inputMode="numeric" autoComplete="off" placeholder="0" value={line.quantity??""} aria-label={`${menu.name} servings sold`}
        onChange={event=>{
         const text=event.target.value;
         if(text===""){updateLine(menu.id,{quantity:null,soldOut:false});return;}
         const value=parseServingsInput(text);
         if(value===undefined){setError("Enter a whole-number serving count from 0 to 1,000,000.");return;}
         updateLine(menu.id,{quantity:value});
        }}/>
        <button type="button" aria-label={`Increase ${menu.name} servings`} disabled={busy||line.quantity===MAX_SALES_SERVINGS} className="grid w-12 shrink-0 place-items-center border-l border-border text-lg font-medium text-slate-600 transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-slate-300" onClick={()=>updateLine(menu.id,{quantity:Math.min(MAX_SALES_SERVINGS,(line.quantity??0)+1)})}>+</button>
       </div>
      </label>
      <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
       <label className="flex items-center gap-2 text-xs text-muted-foreground sm:justify-end">
        <input className="size-4 accent-blue-600" type="checkbox" checked={line.soldOut} disabled={busy||line.quantity===null} onChange={event=>updateLine(menu.id,{soldOut:event.target.checked})}/>
        Sold out
        <span className="sr-only">: {menu.name}</span>
       </label>
       <p className="text-sm font-semibold tabular-nums sm:mt-2">{rowRevenue===null?"—":money.format(rowRevenue/100)}</p>
       <span className="sr-only">estimated revenue</span>
      </div>
     </div>;
    })}
   </div>

   <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-white/95 px-4 py-4 shadow-[0_-8px_20px_-18px_rgba(15,23,42,0.4)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <p className="text-xs leading-5 text-muted-foreground">Blank = not entered. Enter 0 for confirmed no sales. Sold-out is optional.</p>
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
     <Button type="button" variant="ghost" size="sm" disabled={busy||!dirty} onClick={()=>{setDraft(structuredClone(data.day));setDirty(false);setError("");setMessage("");}}>
      <RotateCcw aria-hidden="true"/>Discard
     </Button>
     <Button size="sm" disabled={busy||!dirty||entered===0}>
      <Save aria-hidden="true"/>{busy?"Saving…":"Save sales"}
     </Button>
    </div>
   </div>
   {draft.updatedAt&&<p className="border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-6">Last saved {new Date(draft.updatedAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}{draft.updatedBy?` by ${draft.updatedBy}`:""}</p>}
  </form>

  {!isNew&&draft.lines.some(line=>line.quantity!==null&&(line.unitPriceCents===null||line.ingredientCostPerServingCents===null))&&
   <details className="group mt-4 rounded-2xl border border-amber-200 bg-amber-50">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-medium text-amber-950 [&::-webkit-details-marker]:hidden">
     Some saved costs or prices are missing
     <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180"/>
    </summary>
    <div className="flex flex-col gap-3 border-t border-amber-200 p-4 sm:flex-row sm:items-center sm:justify-between">
     <p className="text-xs leading-5 text-amber-900">An owner can fill missing values from current menu prices and recipe costs. Existing recorded values stay unchanged.</p>
     {canManage&&<Button size="sm" variant="outline" disabled={busy||dirty||expensesDirty} onClick={()=>void fillMissingFinancials()}>{busy?"Working…":"Fill missing values"}</Button>}
     {(dirty||expensesDirty)&&<p className="text-xs text-amber-900">Save or discard your edits first.</p>}
    </div>
   </details>}

  <details className="group mt-4 overflow-hidden rounded-2xl border border-border bg-white">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
    <span><span className="block text-sm font-semibold">Other daily expenses</span><span className="mt-1 block text-xs text-muted-foreground">Optional · rent, utilities, wages, and similar costs</span></span>
    <span className="flex items-center gap-3"><span className="text-sm font-semibold tabular-nums">{money.format(expenseTotal/100)}</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180"/></span>
   </summary>
   <form onSubmit={saveExpenses} className="border-t border-border">
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
     <p className="text-xs text-muted-foreground">Do not include ingredient costs already counted in recipe costing.</p>
     <Button type="button" variant="outline" size="sm" disabled={busy||expensesDraft.length>=100} onClick={()=>{setExpensesDraft(rows=>[...rows,{id:crypto.randomUUID(),category:"",amount:"",note:""}]);setExpensesDirty(true);}}>
      <Plus aria-hidden="true"/>Add expense
     </Button>
    </div>
    <fieldset disabled={busy} className="space-y-3 px-4 pb-4 sm:px-5">
     {expensesDraft.length===0&&<p className="rounded-lg bg-background p-3 text-sm text-muted-foreground">No other expenses recorded for this date.</p>}
     {expensesDraft.map((expense,index)=><div key={expense.id} className="grid gap-3 rounded-xl border border-border p-3 lg:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)_40px] lg:items-end">
      <label className="text-xs font-medium text-muted-foreground">Category
       <Input required minLength={2} maxLength={40} className="mt-1.5 h-10" placeholder="Rent, utilities, wages…" value={expense.category} onChange={event=>editExpense(expense.id,{category:event.target.value})}/>
      </label>
      <label className="block min-w-0 text-xs font-medium text-muted-foreground">Amount (RM)
       <span className="mt-1.5 flex h-11 w-full items-center overflow-hidden rounded-lg border border-input bg-white transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <span aria-hidden="true" className="shrink-0 pl-3 text-sm font-medium text-muted-foreground">RM</span>
        <Input required className="h-full min-w-0 flex-1 rounded-none border-0 px-3 text-right text-base tabular-nums shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm" type="text" inputMode="decimal" autoComplete="off" maxLength={10} pattern="[0-9]+([.,][0-9]{0,2})?" placeholder="0.00" aria-label={`Expense ${index+1} amount in RM`} value={expense.amount} onChange={event=>editExpense(expense.id,{amount:event.target.value})}/>
       </span>
      </label>
      <label className="text-xs font-medium text-muted-foreground">Note <span className="font-normal">(optional)</span>
       <Input maxLength={120} className="mt-1.5 h-10" value={expense.note} onChange={event=>editExpense(expense.id,{note:event.target.value})}/>
      </label>
      <button type="button" className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Remove expense ${index+1}`} onClick={()=>{setExpensesDraft(rows=>rows.filter(row=>row.id!==expense.id));setExpensesDirty(true);}}>
       <Trash2 className="size-4" aria-hidden="true"/>
      </button>
     </div>)}
    </fieldset>
    <div className="flex flex-col gap-3 border-t border-border bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
     <span className="text-sm font-medium">Expense total: {money.format(expenseTotal/100)}</span>
     <Button size="sm" disabled={busy||!expensesDirty}><Save aria-hidden="true"/>{busy?"Saving…":"Save expenses"}</Button>
    </div>
   </form>
  </details>

  <details className="group mt-4 overflow-hidden rounded-2xl border border-border bg-white">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
    <span><span className="block text-sm font-semibold">Profit estimate</span><span className="mt-1 block text-xs text-muted-foreground">Revenue minus estimated ingredient costs and recorded expenses</span></span>
    <span className="flex items-center gap-3"><span className="text-sm font-semibold tabular-nums">{summaryValue(netProfit)}</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180"/></span>
   </summary>
   <div className="border-t border-border p-4 sm:p-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
     {[["Revenue",totalRevenue],["Ingredient costs",ingredientCosts],["Gross profit",grossProfit],["Estimated net profit",netProfit]].map(([label,value])=><article key={label as string} className="rounded-xl bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-base font-semibold tabular-nums">{summaryValue(value as number|null)}</p>
      {label==="Estimated net profit"&&<p className="mt-2 text-xs leading-5 text-muted-foreground">Gross profit − other recorded expenses = estimated net profit</p>}
     </article>)}
    </div>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Estimates use recipe ingredient quantities and saved prices. Missing costs are shown as “Not available”. Unrecorded expenses are not included.</p>
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
     <table className="w-full min-w-[650px] text-left text-sm">
      <thead className="bg-slate-50 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Menu item</th><th scope="col" className="px-4 py-3 font-medium">Servings</th><th scope="col" className="px-4 py-3 font-medium">Revenue</th><th scope="col" className="px-4 py-3 font-medium">Ingredient cost</th><th scope="col" className="px-4 py-3 font-medium">Contribution</th><th scope="col" className="px-4 py-3 font-medium">Recipe details</th></tr></thead>
      <tbody className="divide-y divide-border">
       {salesMenus.map(menu=>{
        const line=draft.lines.find(item=>item.menuId===menu.id)!;
        const quantity=line.quantity;
        const unitCost=lineIngredientCost(line,fallbackCosts);
        const rowRevenue=itemRevenue(line,fallbackPrices);
        const rowCost=quantity===null?null:quantity>0&&unitCost===null?null:quantity*(unitCost??0);
        const contribution=rowRevenue===null||rowCost===null?null:rowRevenue-rowCost;
        const snapshot=line.costSnapshot??(isNew?data.menuCosts[menu.id]:null);
        return <tr key={menu.id}>
         <th scope="row" className="px-4 py-3 font-medium">{menu.name}</th><td className="px-4 py-3">{quantity??"—"}</td>
         <td className="px-4 py-3">{formatMoney(rowRevenue)}</td><td className="px-4 py-3">{formatMoney(rowCost)}</td><td className="px-4 py-3 font-medium">{formatMoney(contribution)}</td>
         <td className="px-4 py-3">{snapshot?<details><summary className="cursor-pointer text-primary">View</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{snapshot.ingredients.map(item=><li key={item.ingredientId}>{item.name}: {item.quantity} {item.unit} / batch · {item.batchCostCents===null?"cost not set":money.format(item.batchCostCents/100)}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Per-serving cost: {formatMoney(snapshot.perServingCostCents)}</p></details>:"—"}</td>
        </tr>;
       })}
      </tbody>
     </table>
    </div>
    {(totalRevenue===null||ingredientCosts===null)&&entered>0&&<p className="mt-3 text-xs text-amber-800">{totalRevenue===null?"Set menu prices in Recipes. ":""}{ingredientCosts===null?"Set missing ingredient prices in Inventory.":""}</p>}
    {canManage&&<a href="/recipes" className="mt-3 inline-block text-xs font-medium text-primary underline underline-offset-4">Review menu and recipe prices</a>}
   </div>
  </details>

  <details className="group mt-4 overflow-hidden rounded-2xl border border-border bg-white">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
    <span><span className="block text-sm font-semibold">Sales trends</span><span className="mt-1 block text-xs text-muted-foreground">Daily, weekly, and monthly revenue and profit estimates</span></span>
    <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180"/>
   </summary>
   <section className="border-t border-border">
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
     <p className="text-xs text-muted-foreground">Periods ending {shortDate(draft.date)}</p>
     <div className="flex w-fit gap-1 rounded-lg bg-background p-1">{(["daily","weekly","monthly"] as const).map(period=><button key={period} type="button" disabled={busy} aria-pressed={trendPeriod===period} onClick={()=>void changeTrend(period)} className={`rounded-md px-3 py-2 text-xs font-medium capitalize ${trendPeriod===period?"bg-white text-primary shadow-sm":"text-muted-foreground hover:text-foreground"}`}>{period}</button>)}</div>
    </div>
    <div className="overflow-x-auto">
     <table className="w-full min-w-[700px] text-left text-sm">
      <thead className="bg-slate-50 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Period</th><th scope="col" className="px-4 py-3 font-medium">Revenue</th><th scope="col" className="px-4 py-3 font-medium">Ingredient costs</th><th scope="col" className="px-4 py-3 font-medium">Other expenses</th><th scope="col" className="px-4 py-3 font-medium">Gross profit</th><th scope="col" className="px-4 py-3 font-medium">Estimated net profit</th></tr></thead>
      <tbody className="divide-y divide-border">{data.trend.map(period=><tr key={period.date}><th scope="row" className="px-4 py-3 font-medium">{period.date}</th><td className="px-4 py-3">{summaryValue(period.revenueCents)}</td><td className="px-4 py-3">{summaryValue(period.ingredientCostCents)}</td><td className="px-4 py-3">{money.format(period.expensesCents/100)}</td><td className="px-4 py-3">{summaryValue(period.grossProfitCents)}</td><td className="px-4 py-3 font-medium">{summaryValue(period.netProfitCents)}</td></tr>)}</tbody>
     </table>
    </div>
    <p className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">A missing price or cost makes that period’s profit estimate unavailable. Periods without saved sales show zero revenue.</p>
   </section>
  </details>

  <details className="group mt-4 overflow-hidden rounded-2xl border border-border bg-white">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
    <span><span className="block text-sm font-semibold">Previous sales records</span><span className="mt-1 block text-xs text-muted-foreground">Open a saved date to review or make a correction</span></span>
    <span className="flex items-center gap-3"><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground"/><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180"/></span>
   </summary>
   <section className="border-t border-border">
    {data.recent.length===0?<p className="p-4 text-sm text-muted-foreground">No sales saved yet.</p>:<div className="divide-y divide-border">{data.recent.map(day=><button type="button" key={day.date} disabled={busy} onClick={()=>void choose(day.date)} className={`block w-full p-4 text-left transition-colors hover:bg-secondary ${day.date===draft.date?"bg-blue-50/60":""}`}>
     <span className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{shortDate(day.date)}</span><span className="text-sm font-semibold tabular-nums">{formatMoney(day.revenueCents)}</span></span>
     <span className="mt-1 block text-xs text-muted-foreground">{day.entered}/{salesMenus.length} items entered · {day.total} servings · net estimate {formatMoney(day.netProfitCents)}{day.sourceDate?" · Imported historical data":""}</span>
    </button>)}</div>}
    <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Changes to a saved date create a new record version; existing price and cost snapshots are preserved.</p>
   </section>
  </details>
  <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><TrendingUp size={15} aria-hidden="true" className="mt-0.5 shrink-0"/>Profit figures are estimates, not accounting statements. Sales entry does not deduct inventory.</p>
 </div>;
}
