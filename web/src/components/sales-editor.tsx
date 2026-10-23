"use client";

import {useRef,useState} from "react";
import {CalendarDays,ChevronDown,Plus,RotateCcw,Save,Trash2,TrendingUp} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {salesMenus,type SalesData,type SalesDay,type SaleLine,type SalesTrendPeriod,type DailyExpense} from "@/lib/sales";
import {calculateProfitTotals,calculateSaleFinancialTotals,calculateSaleLineFinancials} from "@/lib/sales-financials";
import {malaysiaDate,validDate} from "@/lib/inventory";
import {MAX_SALES_SERVINGS,parseExpenseAmount,parseServingsInput} from "@/lib/sales-input";

type ExpenseDraft={id:string;category:string;amount:string;note:string};
const money=new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"});
function formatMoney(cents:number|null){return cents===null?"Not available":money.format(cents/100);}
function servingsFor(lines:SaleLine[]){return lines.reduce((sum,line)=>sum+(line.quantity??0),0);}
function lineIngredientCost(line:SaleLine,fallbackCosts?:SalesData["menuCosts"]){
 return line.ingredientCostPerServingCents??fallbackCosts?.[line.menuId]?.perServingCostCents??null;
}
function initialExpenses(expenses:DailyExpense[]):ExpenseDraft[]{return expenses.map(expense=>({id:expense.id,category:expense.category,amount:(expense.amountCents/100).toFixed(2),note:expense.note}));}
function summaryValue(value:number|null){return value===null?"Not available":money.format(value/100);}
function formatMargin(value:number|null|undefined){return typeof value!=="number"||!Number.isFinite(value)?"Not available":`${value.toFixed(1)}%`;}
function shortDate(value:string){return new Date(`${value}T12:00:00+08:00`).toLocaleDateString("en-MY",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kuala_Lumpur"});}

export function SalesEditor({initialData,canManage=false}:{initialData:SalesData;canManage?:boolean}){
 const [data,setData]=useState(initialData);
 const expensesRef=useRef<HTMLDetailsElement>(null);
 const [draft,setDraft]=useState<SalesDay>(structuredClone(initialData.day));
 const [expensesDraft,setExpensesDraft]=useState<ExpenseDraft[]>(initialExpenses(initialData.expenses));
 const [expensesDirty,setExpensesDirty]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loadingDate,setLoadingDate]=useState(false);
 const [loadingMessage,setLoadingMessage]=useState("");
 const [error,setError]=useState("");
 const [dateError,setDateError]=useState("");
 const [quantityTexts,setQuantityTexts]=useState<Record<string,string>>(()=>Object.fromEntries(initialData.day.lines.map(line=>[line.menuId,line.quantity===null?"":String(line.quantity)])));
 const [quantityErrors,setQuantityErrors]=useState<Record<string,string>>({});
 const [message,setMessage]=useState("");
 const [trendPeriod,setTrendPeriod]=useState<SalesTrendPeriod>(initialData.trendPeriod);
 const saveInProgress=useRef(false);

 const entered=draft.lines.filter(line=>line.quantity!==null).length;
 const total=servingsFor(draft.lines);
 const hasInvalidQuantity=Object.values(quantityErrors).some(Boolean);
 const isNew=draft.version===0;
 const fallbackPrices=isNew?data.menuPrices:undefined;
 const fallbackCosts=isNew?data.menuCosts:undefined;
 const expenseTotal=expensesDraft.reduce((sum,expense)=>sum+(parseExpenseAmount(expense.amount)??0),0);
 const draftLines=draft.lines.map(line=>({...line,unitPriceCents:line.unitPriceCents??fallbackPrices?.[line.menuId]??null,ingredientCostPerServingCents:lineIngredientCost(line,fallbackCosts)}));
 const draftTotals=calculateSaleFinancialTotals(draftLines);
 const expensesRecorded=data.expenseVersion>0&&!expensesDirty;
 const draftFinancial=calculateProfitTotals({date:draft.date,revenueCents:entered===0?null:draftTotals.revenueCents,ingredientCostCents:entered===0?null:draftTotals.ingredientCostCents,expensesCents:expenseTotal,expensesRecorded,salesDays:draft.version>0||entered>0?1:0});
 const totalRevenue=hasInvalidQuantity?null:draftFinancial.revenueCents;
 const ingredientCosts=hasInvalidQuantity?null:draftFinancial.ingredientCostCents;
 const grossProfit=hasInvalidQuantity?null:draftFinancial.grossProfitCents;
 const netProfit=hasInvalidQuantity?null:draftFinancial.netProfitCents;
 const missingFinancialInputs=draft.lines.flatMap(line=>{
  if(line.quantity===null||line.quantity===0)return [];
  const menu=salesMenus.find(item=>item.id===line.menuId)!;
  const price=line.unitPriceCents??(isNew?data.menuPrices[line.menuId]??null:null);
  const snapshot=line.costSnapshot??(isNew?data.menuCosts[line.menuId]??null:null);
  const costPerServing=line.ingredientCostPerServingCents??(isNew?snapshot?.perServingCostCents??null:null);
  const missingIngredients=snapshot?.ingredients.filter(ingredient=>ingredient.batchCostCents===null)??[];
  return [
   ...(price===null?[{key:`price-${line.menuId}`,menuName:menu.name,message:"selling price is missing",href:`/recipes?menu=${encodeURIComponent(menu.id)}`,link:"Review menu price"}]:[]),
   ...(costPerServing===null?(missingIngredients.length
    ?missingIngredients.map(ingredient=>({key:`cost-${line.menuId}-${ingredient.ingredientId}`,menuName:menu.name,message:`ingredient price for ${ingredient.name} is missing`,href:`/inventory?ingredient=${encodeURIComponent(ingredient.ingredientId)}#ingredient-price-setup`,link:`Review ${ingredient.name} price`}))
    :[{key:`cost-${line.menuId}`,menuName:menu.name,message:"recipe ingredient cost is missing",href:`/recipes?menu=${encodeURIComponent(menu.id)}`,link:"Review recipe"}]):[]),
  ];
 });
 const includedExpenses=expensesRecorded?data.expenses:[];

 async function load(date:string,period=trendPeriod){
  const response=await fetch(`/api/sales?date=${encodeURIComponent(date)}&trend=${period}`,{cache:"no-store"});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Could not load sales.");
  return result as SalesData;
 }
 async function choose(date:string){
  if(!validDate(date)||date>malaysiaDate()){
   setDateError("Choose a valid business date today or earlier.");
   return;
  }
  if(date===draft.date){setDateError("");return;}
  if((dirty||expensesDirty)&&!window.confirm("Discard unsaved sales or expense changes?"))return;
  setBusy(true);setLoadingDate(true);setLoadingMessage(`Loading sales for ${shortDate(date)}…`);setError("");setDateError("");setMessage("");
  try{
   const result=await load(date);
   setData(result);setDraft(structuredClone(result.day));setExpensesDraft(initialExpenses(result.expenses));
   setQuantityTexts(Object.fromEntries(result.day.lines.map(line=>[line.menuId,line.quantity===null?"":String(line.quantity)])));
   setQuantityErrors({});
   setDirty(false);setExpensesDirty(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not load this date.");}
  finally{setBusy(false);setLoadingDate(false);setLoadingMessage("");}
 }
 async function saveSales(e:React.FormEvent){
  e.preventDefault();
  if(saveInProgress.current)return;
  if(Object.values(quantityErrors).some(Boolean)){
   setError("Correct the highlighted servings before saving.");
   return;
  }
  if(entered===0){
   setError("Enter a quantity for at least one menu item. Use 0 to confirm no sales.");
   return;
  }
  if(!dirty)return;
  saveInProgress.current=true;setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:draft.date,version:draft.version,lines:draft.lines,trendPeriod})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Could not save sales.");
   setData(result);setDraft(structuredClone(result.day));
   setQuantityTexts(Object.fromEntries(result.day.lines.map((line:SaleLine)=>[line.menuId,line.quantity===null?"":String(line.quantity)])));
   setQuantityErrors({});setDirty(false);
   setMessage(draft.version===0?"Daily sales saved. Your saved prices and costs are kept with this date.":"Sales changes saved. Your original prices and costs are kept with this date.");
  }catch(e){setError(e instanceof Error?e.message:"Could not save sales. Please try again.");}
  finally{saveInProgress.current=false;setBusy(false);}
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
 async function restoreSalesVersion(version:number){
  if(!window.confirm(`Restore version ${version} of ${shortDate(draft.date)} as a new saved version? Current and earlier versions will remain in history.${dirty||expensesDirty?" Unsaved edits will be discarded.":""}`))return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/sales/history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:draft.date,expectedVersion:draft.version,version,trendPeriod})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Could not restore this version.");
   setData(result);setDraft(structuredClone(result.day));
   setQuantityTexts(Object.fromEntries(result.day.lines.map((line:SaleLine)=>[line.menuId,line.quantity===null?"":String(line.quantity)])));
   setQuantityErrors({});setDirty(false);
   setExpensesDraft(initialExpenses(result.expenses));setExpensesDirty(false);
   setMessage(`Version ${version} restored as version ${result.day.version}. All saved versions were preserved.`);
  }catch(e){setError(e instanceof Error?e.message:"Could not restore this version. No changes were saved.");}
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
  setBusy(true);setLoadingDate(true);setLoadingMessage(`Loading ${period} trend…`);setError("");
  try{const result=await load(draft.date,period);setData(result);setTrendPeriod(period);}
  catch(e){setError(e instanceof Error?e.message:"Could not load this trend.");}
  finally{setBusy(false);setLoadingDate(false);setLoadingMessage("");}
 }
 function updateLine(menuId:string,patch:Partial<SaleLine>){
  setDraft(current=>({...current,lines:current.lines.map(line=>line.menuId===menuId?{...line,...patch}:line)}));
  if("quantity" in patch){
   setQuantityTexts(current=>({...current,[menuId]:patch.quantity===null?"":String(patch.quantity)}));
   setQuantityErrors(current=>({...current,[menuId]:""}));
  }
  setDirty(true);setMessage("");setError("");
 }
 function cancelSalesChanges(){
  if((dirty||Object.values(quantityErrors).some(Boolean))&&!window.confirm("Discard your unsaved sales changes?"))return;
  setDraft(structuredClone(data.day));
  setQuantityTexts(Object.fromEntries(data.day.lines.map(line=>[line.menuId,line.quantity===null?"":String(line.quantity)])));
  setQuantityErrors({});setDirty(false);setError("");setMessage("");
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
    <p className="mt-2 text-sm font-medium text-foreground">Business date · {shortDate(draft.date)} (Malaysia)</p>
   </div>
   <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
    <label htmlFor="sales-date" className="block w-full text-sm font-medium sm:w-56">Select business date
     <span className="relative mt-2 block">
      <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"/>
      <Input id="sales-date" className="pl-10" type="date" max={malaysiaDate()} value={draft.date} disabled={busy} aria-invalid={Boolean(dateError)} aria-describedby={dateError?"sales-date-error":undefined} onChange={event=>void choose(event.target.value)}/>
     </span>
    </label>
    {dateError&&<p id="sales-date-error" className="w-full text-xs text-destructive sm:w-56" role="alert">{dateError}</p>}
    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-medium ${dirty?"bg-amber-50 text-amber-800":draft.version?"bg-emerald-50 text-emerald-800":"bg-slate-100 text-slate-600"}`} role="status">
     {loadingDate?"Loading…":busy?"Saving…":dirty?"Unsaved changes":draft.version?"Saved":"Not entered"}
    </span>
   </div>
   </header>
   {loadingDate&&<p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">{loadingMessage}</p>}

  {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-destructive">{error}</p>}
  {message&&<p role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}
  {draft.provenance&&<p className="mt-4 inline-flex rounded-full border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground">Imported historical record · {draft.provenance.sourceDate}</p>}

  <form onSubmit={saveSales} className="mt-6 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
   <div className="flex flex-col gap-2 border-b border-border px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <div>
     <h2 className="text-lg font-semibold">{draft.date===malaysiaDate()&&!draft.version?"Enter today’s sales":draft.version?"Edit sales":"Enter sales"}</h2>
     <p className="mt-1 text-sm text-muted-foreground">How many servings of each item did you sell on {shortDate(draft.date)}?</p>
    </div>
   </div>

   <div className="overflow-x-auto">
    <table className="w-full min-w-[680px] text-left text-sm">
     <thead className="bg-slate-50 text-xs text-muted-foreground">
      <tr><th scope="col" className="px-4 py-3 font-medium sm:px-6">Menu item</th><th scope="col" className="px-4 py-3 font-medium">Servings sold</th><th scope="col" className="px-4 py-3 text-right font-medium">Selling price</th><th scope="col" className="px-4 py-3 text-right font-medium">Revenue</th></tr>
     </thead>
     <tbody className="divide-y divide-border">
    {salesMenus.map(menu=>{
     const line=draft.lines.find(item=>item.menuId===menu.id)!;
     const price=line.unitPriceCents??fallbackPrices?.[menu.id]??null;
     const rowRevenue=calculateSaleLineFinancials(draftLines.find(item=>item.menuId===menu.id)!).revenueCents;
     const fieldError=quantityErrors[menu.id];
     return <tr key={menu.id}>
      <th scope="row" className="px-4 py-4 font-semibold sm:px-6">{menu.name}<span className="mt-1 block text-xs font-normal text-muted-foreground">{menu.category}</span><label className="mt-2 flex items-center gap-2 text-xs font-normal text-muted-foreground"><input className="size-4 accent-blue-600" type="checkbox" checked={line.soldOut} disabled={busy||line.quantity===null||Boolean(fieldError)} onChange={event=>updateLine(menu.id,{soldOut:event.target.checked})}/>Sold out</label></th>
      <td className="px-4 py-4">
       <div className="flex h-11 w-40 items-stretch overflow-hidden rounded-lg border border-input focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <button type="button" aria-label={`Decrease ${menu.name} servings`} disabled={busy||line.quantity===null||line.quantity===0} className="grid w-10 shrink-0 place-items-center border-r border-border text-lg font-medium text-slate-600 hover:bg-secondary disabled:text-slate-300" onClick={()=>updateLine(menu.id,{quantity:Math.max(0,(line.quantity??1)-1)})}>−</button>
        <Input id={`sale-${menu.id}`} className="h-full min-w-0 rounded-none border-0 px-1 text-center text-base font-semibold tabular-nums shadow-none focus-visible:border-0 focus-visible:ring-0" type="text" pattern="[0-9]*" maxLength={7} inputMode="numeric" autoComplete="off" placeholder="0" value={quantityTexts[menu.id]??""} aria-label={`${menu.name} servings sold`} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError?`sale-${menu.id}-error`:undefined}
         onChange={event=>{
          const text=event.target.value;
          setQuantityTexts(current=>({...current,[menu.id]:text}));
          setDirty(true);setMessage("");setError("");
          const quantity=parseServingsInput(text);
          if(quantity===undefined){
           setQuantityErrors(current=>({...current,[menu.id]:"Enter a whole number from 0 to 1,000,000."}));
           return;
          }
          setQuantityErrors(current=>({...current,[menu.id]:""}));
          setDraft(current=>({...current,lines:current.lines.map(item=>item.menuId===menu.id?{...item,quantity,soldOut:quantity===null?false:item.soldOut}:item)}));
         }}/>
        <button type="button" aria-label={`Increase ${menu.name} servings`} disabled={busy||line.quantity===MAX_SALES_SERVINGS} className="grid w-10 shrink-0 place-items-center border-l border-border text-lg font-medium text-slate-600 hover:bg-secondary disabled:text-slate-300" onClick={()=>updateLine(menu.id,{quantity:Math.min(MAX_SALES_SERVINGS,(line.quantity??0)+1)})}>+</button>
       </div>
       {fieldError&&<p id={`sale-${menu.id}-error`} className="mt-1 max-w-48 text-xs text-destructive" role="alert">{fieldError}</p>}
      </td>
      <td className="px-4 py-4 text-right tabular-nums">{price===null?<span className="text-muted-foreground">Not set</span>:money.format(price/100)}<span className="block text-xs text-muted-foreground">per serving</span></td>
      <td className="px-4 py-4 text-right font-semibold tabular-nums">{fieldError?"Not available":line.quantity===null?"—":rowRevenue===null?"Not available":money.format(rowRevenue/100)}</td>
     </tr>;
    })}
     </tbody>
    </table>
   </div>

   <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-white/95 px-4 py-4 shadow-[0_-8px_20px_-18px_rgba(15,23,42,0.4)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <p className="text-xs leading-5 text-muted-foreground">Blank = not entered. Enter 0 for confirmed no sales. Sold-out is optional.</p>
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
     <Button type="button" variant="ghost" size="sm" disabled={busy||!dirty&&!Object.values(quantityErrors).some(Boolean)} onClick={cancelSalesChanges}>
      <RotateCcw aria-hidden="true"/>Cancel
     </Button>
     <Button size="sm" disabled={busy||!dirty||entered===0||Object.values(quantityErrors).some(Boolean)}>
      <Save aria-hidden="true"/>{busy?"Saving…":draft.version?"Save changes":"Save sales"}
     </Button>
    </div>
   </div>
   {draft.updatedAt&&<p className="border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-6">Last saved {new Date(draft.updatedAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}{draft.updatedBy?` by ${draft.updatedBy}`:""}</p>}
  </form>

  <section aria-label="Sales summary" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
    <p className="text-sm text-muted-foreground">Revenue</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{summaryValue(totalRevenue)}</p>
    <p className="mt-1 text-xs text-muted-foreground">Calculated from quantities entered and saved selling prices</p>
   </article>
   <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
    <p className="text-sm text-muted-foreground">Servings sold</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{hasInvalidQuantity?"Not available":total}</p>
    <p className="mt-1 text-xs text-muted-foreground">{entered} of {salesMenus.length} items entered</p>
   </article>
   <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
    <p className="text-sm text-muted-foreground">Ingredient cost of sales</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{summaryValue(ingredientCosts)}</p>
    <p className="mt-1 text-xs text-muted-foreground">Estimated recipe cost for servings sold</p>
   </article>
   <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
    <p className="text-sm text-muted-foreground">Gross profit</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{summaryValue(grossProfit)}</p>
    <p className="mt-1 text-xs text-muted-foreground">Calculated: revenue minus estimated ingredient cost</p>
   </article>
  </section>

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

  <section aria-labelledby="profit-estimate-heading" className="mt-5 rounded-2xl border border-border bg-white p-4 sm:p-5">
   <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
     <h2 id="profit-estimate-heading" className="text-lg font-semibold">Profit estimate</h2>
     <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Estimated net profit is calculated gross profit minus the other expenses saved for this date. It is not a verified accounting figure; any expenses not recorded here are excluded.</p>
    </div>
    <div className="shrink-0 rounded-xl bg-background px-4 py-3 sm:text-right">
     <p className="text-xs text-muted-foreground">Estimated net profit</p>
     <p className="mt-1 text-xl font-semibold tabular-nums">{summaryValue(netProfit)}</p>
     <p className="mt-2 text-xs leading-5 text-muted-foreground">Gross profit − other recorded expenses = estimated net profit</p>
    </div>
   </div>
   {missingFinancialInputs.length>0&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
    <h3 className="text-sm font-semibold text-amber-950">Estimate incomplete: check these required inputs</h3>
    <ul className="mt-2 space-y-2 text-sm text-amber-950">
     {missingFinancialInputs.map(input=><li key={input.key} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      <span>{input.menuName}: {input.message}.</span><a className="font-medium underline underline-offset-2" href={input.href}>{input.link}</a>
     </li>)}
    </ul>
   </div>}
   <div className="mt-4 rounded-xl border border-border p-4">
    <h3 className="text-sm font-semibold">Other expenses included</h3>
    {expensesRecorded?includedExpenses.length===0
     ?<p className="mt-1 text-sm text-muted-foreground">Confirmed none recorded for {shortDate(draft.date)}.</p>
     :<ul className="mt-2 space-y-1 text-sm">{includedExpenses.map(expense=><li key={expense.id} className="flex justify-between gap-4"><span>{expense.category}{expense.note?` · ${expense.note}`:""}</span><span className="shrink-0 font-medium tabular-nums">{money.format(expense.amountCents/100)}</span></li>)}</ul>
     :<p className="mt-1 text-sm text-amber-800">No saved expense list is available, so estimated net profit is unavailable. Record expenses or confirm none below. Unsaved edits are not included.</p>}
    {expensesDirty&&<p className="mt-2 text-sm text-amber-800">Expense changes are unsaved and are not included in this estimate.</p>}
    <a href="#daily-expenses" onClick={()=>{if(expensesRef.current)expensesRef.current.open=true;}} className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4">{expensesRecorded?"Review or update expenses":"Record or confirm expenses"}</a>
   </div>
   <p className="mt-3 text-xs text-muted-foreground">Gross profit margin: {formatMargin(hasInvalidQuantity?null:draftFinancial.grossProfitMarginPercent)} · Estimated net margin: {formatMargin(hasInvalidQuantity?null:draftFinancial.netProfitMarginPercent)}</p>
  </section>

  <details ref={expensesRef} id="daily-expenses" className="group overflow-hidden rounded-xl border border-border bg-white">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
    <span><span className="block text-sm font-semibold">Other daily expenses</span><span className="mt-1 block text-xs text-muted-foreground">Rent, utilities, wages, and similar costs</span></span>
    <span className="flex items-center gap-3"><span className="text-sm font-semibold tabular-nums">{money.format(expenseTotal/100)}</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180"/></span>
   </summary>
   <form onSubmit={saveExpenses} className="border-t border-border">
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
     <p className="text-xs text-muted-foreground">Do not include ingredient costs already counted in recipe costing. Save an empty list to confirm no other expenses were recorded.</p>
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
      <button type="button" className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Remove expense ${index+1}`} onClick={()=>{if(window.confirm("Remove this expense from the unsaved list?")){setExpensesDraft(rows=>rows.filter(row=>row.id!==expense.id));setExpensesDirty(true);}}}>
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

  <section aria-labelledby="menu-financials-heading" className="mt-5 overflow-hidden rounded-2xl border border-border bg-white">
   <div className="border-b border-border p-4 sm:p-5">
    <h2 id="menu-financials-heading" className="text-lg font-semibold">Menu-level financial details</h2>
    <p className="mt-1 text-sm text-muted-foreground">Revenue and estimated ingredient cost for servings sold. Contribution is calculated revenue minus estimated ingredient cost. A negative value means the estimated cost exceeds revenue; it does not by itself mean the selling price is wrong. Check the recipe and ingredient-cost inputs too.</p>
   </div>
   <div className="p-4 sm:p-5">
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
     <table className="w-full min-w-[960px] text-left text-sm">
     <thead className="bg-slate-50 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Menu item</th><th scope="col" className="px-4 py-3 font-medium">Servings sold</th><th scope="col" className="px-4 py-3 font-medium">Revenue</th><th scope="col" className="px-4 py-3 font-medium">Ingredient cost</th><th scope="col" className="px-4 py-3 font-medium">Contribution</th><th scope="col" className="px-4 py-3 font-medium">Cost details</th></tr></thead>
      <tbody className="divide-y divide-border">
       {salesMenus.map(menu=>{
        const line=draft.lines.find(item=>item.menuId===menu.id)!;
        const quantity=line.quantity;
        const itemFinancial=quantityErrors[menu.id]?null:calculateSaleLineFinancials(draftLines.find(item=>item.menuId===menu.id)!);
        const snapshot=line.costSnapshot??(isNew?data.menuCosts[menu.id]:null);
        return <tr key={menu.id}>
         <th scope="row" className="px-4 py-3 font-medium">{menu.name}</th><td className="px-4 py-3">{quantity??"—"}</td>
         <td className="px-4 py-3">{formatMoney(itemFinancial?.revenueCents??null)}</td><td className="px-4 py-3">{quantity===null?"—":itemFinancial?.ingredientCostCents===null?<span className="font-medium text-amber-800" role="status">Cost incomplete</span>:formatMoney(itemFinancial?.ingredientCostCents??null)}</td><td className={`px-4 py-3 font-medium ${itemFinancial&&itemFinancial.contributionCents!==null&&itemFinancial.contributionCents<0?"text-red-700":""}`}>{itemFinancial?.contributionCents!==null&&itemFinancial?.contributionCents!==undefined&&itemFinancial.contributionCents<0?<span><span aria-hidden="true">−</span>{money.format(Math.abs(itemFinancial.contributionCents)/100)} <span className="sr-only">Negative contribution. Estimated ingredient cost exceeded revenue.</span></span>:formatMoney(itemFinancial?.contributionCents??null)}</td>
         <td className="px-4 py-3">{snapshot?<details><summary className="cursor-pointer text-primary">View recipe costs</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{snapshot.ingredients.map(item=><li key={item.ingredientId}>{item.name}: {item.quantity} {item.unit} / batch · {item.batchCostCents===null?<span className="font-medium text-amber-800" role="status">Cost incomplete</span>:money.format(item.batchCostCents/100)}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Per-serving cost: {formatMoney(snapshot.perServingCostCents)}</p>{snapshot.perServingCostCents===null&&<a href={`/recipes?menu=${encodeURIComponent(menu.id)}`} className="mt-2 inline-block text-xs font-medium text-primary underline underline-offset-4">Review {menu.name} recipe</a>}</details>:quantity===null?"—":<span className="text-amber-800" role="status">Recipe cost unavailable · <a href={`/recipes?menu=${encodeURIComponent(menu.id)}`} className="font-medium underline underline-offset-4">Review {menu.name} recipe</a></span>}</td>
        </tr>;
       })}
      </tbody>
     </table>
    </div>
    {(totalRevenue===null||ingredientCosts===null)&&entered>0&&<p className="mt-3 text-sm text-amber-800" role="status">{totalRevenue===null?"Revenue is unavailable because a selling price is missing. ":""}{ingredientCosts===null?"Ingredient cost of sales is unavailable because a recipe ingredient price or quantity is missing.":""}</p>}
    {canManage&&<a href="/recipes" className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4">Open Recipes to review menu prices and costs</a>}
   </div>
  </section>

  <details className="group mt-5 overflow-hidden rounded-2xl border border-border bg-white">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
    <span><span className="block text-sm font-semibold">Historical sales records</span><span className="mt-1 block text-xs text-muted-foreground">Open previous dates or review sales trends</span></span>
    <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground"/>
   </summary>
   <div className="space-y-3 border-t border-border p-4 sm:p-5">
  <details className="group overflow-hidden rounded-xl border border-border bg-white">
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
     <table className="w-full min-w-[900px] text-left text-sm">
       <thead className="bg-slate-50 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Period</th><th scope="col" className="px-4 py-3 font-medium">Revenue</th><th scope="col" className="px-4 py-3 font-medium">Ingredient cost of sales</th><th scope="col" className="px-4 py-3 font-medium">Recorded other expenses</th><th scope="col" className="px-4 py-3 font-medium">Gross profit</th><th scope="col" className="px-4 py-3 font-medium">Gross margin</th><th scope="col" className="px-4 py-3 font-medium">Estimated net profit</th><th scope="col" className="px-4 py-3 font-medium">Estimated net margin</th></tr></thead>
       <tbody className="divide-y divide-border">{data.trend.map(period=><tr key={period.date}><th scope="row" className="px-4 py-3 font-medium">{period.date}</th><td className="px-4 py-3">{summaryValue(period.revenueCents)}</td><td className="px-4 py-3">{summaryValue(period.ingredientCostCents)}</td><td className="px-4 py-3">{period.expensesRecorded?money.format(period.expensesCents/100):"Not available"}</td><td className="px-4 py-3">{summaryValue(period.grossProfitCents)}</td><td className="px-4 py-3">{formatMargin(period.grossProfitMarginPercent)}</td><td className="px-4 py-3 font-medium">{summaryValue(period.netProfitCents)}</td><td className="px-4 py-3">{formatMargin(period.netProfitMarginPercent)}</td></tr>)}</tbody>
     </table>
    </div>
    <p className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">Missing prices, costs, or expense records make the corresponding estimate unavailable. Periods without saved sales show zero revenue.</p>
   </section>
  </details>

  <section className="overflow-hidden rounded-xl border border-border bg-white">
   <div className="border-b border-border p-4">
    <h3 className="text-sm font-semibold">Saved sales records</h3>
    <p className="mt-1 text-xs text-muted-foreground">Open a saved date to review or make a correction.</p>
   </div>
   <div>
    {data.recent.length===0?<p className="p-4 text-sm text-muted-foreground">No sales saved yet.</p>:<div className="divide-y divide-border">{data.recent.map(day=><button type="button" key={day.date} disabled={busy} onClick={()=>void choose(day.date)} className={`block w-full p-4 text-left transition-colors hover:bg-secondary ${day.date===draft.date?"bg-blue-50/60":""}`}>
     <span className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{shortDate(day.date)}</span><span className="text-sm font-semibold tabular-nums">{formatMoney(day.revenueCents)}</span></span>
     <span className="mt-1 block text-xs text-muted-foreground">Version {day.version} · {day.entered}/{salesMenus.length} items entered · {day.total} servings · {day.netProfitCents===null?"net estimate unavailable; open to review missing inputs":`estimated net ${formatMoney(day.netProfitCents)}`}{day.sourceDate?" · Imported historical data":""}</span>
    </button>)}</div>}
    <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Changes to a saved date create a new record version; existing price and cost snapshots are preserved.</p>
   </div>
  </section>
  {draft.version>0&&<section aria-labelledby="sales-version-history-heading" className="overflow-hidden rounded-xl border border-border bg-white">
   <div className="border-b border-border p-4">
    <h3 id="sales-version-history-heading" className="text-sm font-semibold">Version history for {shortDate(draft.date)}</h3>
    <p className="mt-1 text-xs text-muted-foreground">The latest version is active. Earlier snapshots are read-only; restoring one saves a new version and keeps every existing version.</p>
   </div>
   <ol className="divide-y divide-border">
    {data.history.map((entry,index)=><li key={entry.version} className="p-4">
     <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
       <span><span className="block text-sm font-semibold">{index===0?`Latest saved version · v${entry.version}`:`Earlier version · v${entry.version}`}</span><span className="mt-1 block text-xs text-muted-foreground">{new Date(entry.changedAt).toLocaleString("en-MY",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kuala_Lumpur"})} · saved by {entry.changedBy}{entry.restoredFromVersion?` · restored from v${entry.restoredFromVersion}`:""}{entry.financialCorrection?` · ${entry.financialCorrection}`:""}</span></span>
       <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"/>
      </summary>
      <div className="mt-3 overflow-x-auto border-t border-border pt-3">
       <table className="w-full min-w-[520px] text-left text-xs">
        <thead className="text-muted-foreground"><tr><th scope="col" className="py-2 pr-3 font-medium">Menu item</th><th scope="col" className="py-2 pr-3 font-medium">Servings</th><th scope="col" className="py-2 pr-3 font-medium">Saved selling price</th><th scope="col" className="py-2 font-medium">Saved ingredient cost / serving</th></tr></thead>
        <tbody className="divide-y divide-border">{entry.day.lines.map(line=><tr key={line.menuId}><th scope="row" className="py-2 pr-3 font-medium">{salesMenus.find(menu=>menu.id===line.menuId)?.name??line.menuId}</th><td className="py-2 pr-3">{line.quantity===null?"Not entered":line.quantity}</td><td className="py-2 pr-3">{formatMoney(line.unitPriceCents)}</td><td className="py-2">{formatMoney(line.ingredientCostPerServingCents)}</td></tr>)}</tbody>
       </table>
       {index>0&&<Button className="mt-3" variant="outline" size="sm" disabled={busy} onClick={()=>void restoreSalesVersion(entry.version)}>Restore version {entry.version}</Button>}
      </div>
     </details>
    </li>)}
   </ol>
   <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Financial estimates use each version’s saved selling-price and recipe-cost snapshots. An unavailable value remains unavailable in that historical version.</p>
  </section>}
   </div>
  </details>
  <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><TrendingUp size={15} aria-hidden="true" className="mt-0.5 shrink-0"/>Profit figures are estimates, not accounting statements. Sales entry does not deduct inventory.</p>
 </div>;
}
