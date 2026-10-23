"use client";

import {useEffect,useRef,useState} from "react";
import {AlertTriangle,Check,ChevronDown,Package,Plus,Save,Search,X} from "lucide-react";
import {ingredients,unitsFor,baseQuantity,type Unit} from "@/lib/recipes";
import {malaysiaDate,addDays,type Inventory,type Batch} from "@/lib/inventory";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {IngredientPrices} from "@/components/ingredient-prices";

const selectClass="mt-2 h-12 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10";
type IngredientFilter="all"|"attention"|"not-recorded";

export function InventoryEditor({initialInventory,canManage}:{initialInventory:Inventory;canManage:boolean}){
 const [stock,setStock]=useState(initialInventory);
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState<IngredientFilter>("all");
 const [form,setForm]=useState<ReturnType<typeof makeForm>|null>(null);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const editorRef=useRef<HTMLElement>(null);
 const ingredientPriceSetupRef=useRef<HTMLDetailsElement>(null);
 const editorOpen=form!==null;
 const editingBatchId=form?.id;
 const today=malaysiaDate();
 const soon=addDays(today,2);
 const trackedIngredients=ingredients.filter(i=>i.id!=="water");

 useEffect(()=>{
  if(editorOpen){
   editorRef.current?.focus({preventScroll:true});
   editorRef.current?.scrollIntoView({block:"start"});
  }
 },[editorOpen,editingBatchId]);

 useEffect(()=>{
  if(window.location.hash!=="#ingredient-price-setup")return;
  const setup=ingredientPriceSetupRef.current;
  if(!setup)return;
  setup.open=true;
  const ingredientId=new URLSearchParams(window.location.search).get("ingredient");
  const target=ingredientId?document.getElementById(`price-${ingredientId}`):setup.querySelector("summary");
  target?.scrollIntoView({block:"center"});
  target?.focus({preventScroll:true});
 },[]);

 function makeForm(batch?:Batch){
  const id=batch?.ingredientId||"rice";
  const pack=stock.packs.find(p=>p.ingredientId===id);
  return {
   id:batch?.id,
   version:batch?.version,
   ingredientId:id,
   quantity:batch?.quantity??0,
   unit:batch?.unit||unitsFor(id)[1]||unitsFor(id)[0],
   countDate:batch?.countDate||today,
   expiryDate:batch?.expiryDate||"",
   packQuantity:pack?.quantity||1,
   packUnit:pack?.unit||unitsFor(id)[0],
   packLabel:pack?.label||"pack",
  };
 }

 async function submit(value:unknown){
  setPending(true);
  setError("");
  setMessage("");
  try{
   const response=await fetch("/api/inventory",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(value),
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not save inventory.");
   setStock(data);
   setForm(null);
   setMessage("Inventory saved. Sales are not deducted from closing stock.");
  }catch(e){
   setError(e instanceof Error?e.message:"Could not save inventory.");
  }finally{
   setPending(false);
  }
 }

 const recordedIngredients=new Set(stock.batches.map(b=>b.ingredientId)).size;
 const expiring=stock.batches.filter(b=>b.quantity>0&&b.expiryDate&&b.expiryDate>=today&&b.expiryDate<=soon).length;
 const expired=stock.batches.filter(b=>b.quantity>0&&b.expiryDate&&b.expiryDate<today).length;
 const hasAttention=(ingredientId:string)=>stock.batches.some(b=>b.ingredientId===ingredientId&&b.quantity>0&&!!b.expiryDate&&b.expiryDate<=soon);
 const visibleIngredients=trackedIngredients.filter(i=>{
  if(!i.name.toLowerCase().includes(search.trim().toLowerCase()))return false;
  if(filter==="attention")return hasAttention(i.id);
  if(filter==="not-recorded")return !stock.batches.some(b=>b.ingredientId===i.id);
  return true;
 });

 return <>
  <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
   <div>
    <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-blue-600">KNOW WHAT’S IN YOUR KITCHEN</p>
    <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Keep an accurate count of the ingredients you have and spot batches that need attention.</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    {canManage&&<Button variant="outline" disabled={pending||stock.batches.length>0} onClick={()=>{
     if(window.confirm("Load hypothetical closing stock for all 17 ingredients? Expiry examples are not storage advice."))void submit({action:"seed-demo"});
    }}>Load sample stock</Button>}
    <Button disabled={pending} onClick={()=>{setForm(makeForm());setError("");}}>
     <Plus aria-hidden="true"/>Add stock batch
    </Button>
   </div>
  </header>

  <section aria-label="How to use inventory" className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
   <div className="flex gap-3">
    <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700"><Package size={18} aria-hidden="true"/></div>
    <div>
     <h2 className="text-sm font-semibold text-foreground">A quick guide to stock counts</h2>
     <p className="mt-1 text-sm leading-6 text-secondary-foreground">Count what remains after closing, then add each ingredient batch separately. Do not subtract today’s sales again. Water is not stock-tracked.</p>
     <p className="mt-2 text-xs leading-5 text-muted-foreground">Remaining quantity is what you have now; purchase pack size describes the supplier pack. The owner manages pack settings and ingredient prices.</p>
    </div>
   </div>
  </section>

  <section aria-label="Inventory summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {[
    {label:"Ingredients counted",value:`${recordedIngredients} / ${trackedIngredients.length}`,detail:"with at least one batch",color:"text-blue-700"},
    {label:"Stock batches",value:stock.batches.length,detail:"recorded batches",color:"text-foreground"},
    {label:"Batches expiring soon",value:expiring,detail:"within the next 2 days",color:"text-amber-700"},
    {label:"Batches past expiry",value:expired,detail:"check before use",color:expired?"text-red-700":"text-foreground"},
   ].map(card=><article key={card.label} className="rounded-2xl border border-border bg-white p-4 sm:p-5">
    <p className="text-sm text-muted-foreground">{card.label}</p>
    <p className={`mt-2 text-2xl font-semibold tracking-tight ${card.color}`}>{card.value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
   </article>)}
  </section>

  {error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-destructive">{error}</p>}
  {message&&<p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><Check size={18} aria-hidden="true" className="mt-0.5 shrink-0"/>{message}</p>}

  {form&&<section ref={editorRef} tabIndex={-1} className="mt-6 scroll-mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/20 sm:p-6" aria-label="Stock batch editor">
   <div className="mb-5 flex items-start justify-between gap-4">
    <div>
     <h2 className="text-lg font-semibold">{form.id?"Correct a stock batch":"Add a stock batch"}</h2>
     <p className="mt-1 text-sm text-muted-foreground">Enter the amount remaining in this one batch.</p>
    </div>
    <Button variant="ghost" size="icon" type="button" disabled={pending} aria-label="Close stock editor" onClick={()=>setForm(null)}><X aria-hidden="true"/></Button>
   </div>
   <form onSubmit={e=>{e.preventDefault();void submit(form);}}>
    <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
     <legend className="sr-only">Stock details</legend>
     <label className="text-sm font-medium text-foreground">Ingredient
      <select className={selectClass} disabled={!!form.id} value={form.ingredientId} onChange={e=>{
       const id=e.target.value as typeof form.ingredientId;
       const pack=stock.packs.find(p=>p.ingredientId===id);
       setForm({...form,ingredientId:id,unit:unitsFor(id)[0],packUnit:pack?.unit||unitsFor(id)[0],packQuantity:pack?.quantity||1,packLabel:pack?.label||"pack"});
      }}>
       {trackedIngredients.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
     </label>
     <label className="text-sm font-medium text-foreground">Amount remaining
      <Input className="mt-2" required type="number" min="0" step={form.unit==="pieces"?1:"any"} value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})}/>
      <span className="mt-1 block text-xs font-normal text-muted-foreground">Count only what remains in this batch.</span>
     </label>
     <label className="text-sm font-medium text-foreground">Unit
      <select className={selectClass} value={form.unit} onChange={e=>{
       const unit=e.target.value as Unit;
       setForm({...form,unit,quantity:baseQuantity(form.quantity,form.unit)/(unit==="kg"||unit==="L"?1000:1)});
      }}>{unitsFor(form.ingredientId).map(u=><option key={u}>{u}</option>)}</select>
     </label>
     <label className="text-sm font-medium text-foreground">Date counted
      <Input className="mt-2" required type="date" max={today} value={form.countDate} onChange={e=>setForm({...form,countDate:e.target.value})}/>
     </label>
     <label className="text-sm font-medium text-foreground">Expiry date <span className="font-normal text-muted-foreground">(optional)</span>
      <Input className="mt-2" type="date" value={form.expiryDate} onChange={e=>setForm({...form,expiryDate:e.target.value})}/>
     </label>
    </fieldset>

    <fieldset disabled={pending||!canManage} className="mt-6 grid min-w-0 gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-3">
     <legend className="px-1 text-sm font-semibold text-foreground">Purchase pack settings · Owner</legend>
     <label className="text-sm font-medium text-foreground">Pack name
      <Input className="mt-2" required maxLength={30} value={form.packLabel} onChange={e=>setForm({...form,packLabel:e.target.value})}/>
     </label>
     <label className="text-sm font-medium text-foreground">Quantity per pack
      <Input className="mt-2" required type="number" min="0.001" step={form.packUnit==="pieces"?1:"any"} value={form.packQuantity} onChange={e=>setForm({...form,packQuantity:Number(e.target.value)})}/>
     </label>
     <label className="text-sm font-medium text-foreground">Pack unit
      <select className={selectClass} value={form.packUnit} onChange={e=>{
       const unit=e.target.value as Unit;
       setForm({...form,packUnit:unit,packQuantity:baseQuantity(form.packQuantity,form.packUnit)/(unit==="kg"||unit==="L"?1000:1)});
      }}>{unitsFor(form.ingredientId).map(u=><option key={u}>{u}</option>)}</select>
     </label>
     {!canManage&&<p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-3">These settings are set by the owner. You can still record the remaining stock above.</p>}
    </fieldset>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Each batch is counted separately. If a batch is used up, edit its quantity to 0 so its history is kept.</p>
    <Button className="mt-5" size="sm" disabled={pending}><Save aria-hidden="true"/>{pending?"Saving…":form.id?"Save correction":"Save stock batch"}</Button>
   </form>
  </section>}

  {canManage?<details ref={ingredientPriceSetupRef} id="ingredient-price-setup" className="group mt-6 overflow-hidden rounded-2xl border border-border bg-white">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 outline-none focus-visible:ring-4 focus-visible:ring-primary/20 [&::-webkit-details-marker]:hidden">
    <span>
     <span className="block font-semibold">Ingredient price setup</span>
     <span className="mt-1 block text-sm text-muted-foreground">Set the prices used to estimate recipe costs. Only owners can change these.</span>
    </span>
    <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"/>
   </summary>
   <div className="border-t border-border px-4 pb-4 sm:px-5">
    <IngredientPrices prices={stock.prices??[]} canManage={canManage} onSaved={setStock}/>
   </div>
  </details>:<p className="mt-6 rounded-xl border border-border bg-white p-4 text-sm leading-6 text-muted-foreground">Ingredient prices and recipe cost settings are managed by the owner. You can add stock batches and review their quantities here.</p>}

  <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-white">
   <div className="border-b border-border p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
     <div>
      <h2 className="font-semibold">Ingredients and batches</h2>
      <p className="mt-1 text-sm text-muted-foreground">See your recorded quantity and check expiry dates by batch.</p>
     </div>
     <div className="relative w-full sm:max-w-xs">
      <Search className="absolute left-3 top-3.5 size-4 text-slate-400" aria-hidden="true"/>
      <Input aria-label="Search ingredients" placeholder="Search ingredients" value={search} onChange={e=>setSearch(e.target.value)} className="h-11 pl-9 pr-10"/>
      {search&&<button type="button" aria-label="Clear ingredient search" className="absolute right-2 top-1.5 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={()=>setSearch("")}><X size={16} aria-hidden="true"/></button>}
     </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter ingredients">
     {([
      ["all","All ingredients",trackedIngredients.length],
      ["attention","Needs attention",trackedIngredients.filter(i=>hasAttention(i.id)).length],
      ["not-recorded","Not recorded",trackedIngredients.filter(i=>!stock.batches.some(b=>b.ingredientId===i.id)).length],
     ] as const).map(([value,label,count])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)} className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${filter===value?"border-primary bg-blue-50 text-blue-800":"border-border bg-white text-muted-foreground hover:bg-background"}`}>
      {label}<span className="ml-1.5 tabular-nums">{count}</span>
     </button>)}
    </div>
   </div>

   {stock.batches.length===0&&<div className="border-b border-border bg-blue-50/60 px-5 py-5 sm:px-6">
    <p className="text-sm font-semibold">Start by counting what you have</p>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose “Add stock batch”, pick an ingredient, and enter the amount remaining. You can add separate batches for the same ingredient.</p>
    {canManage&&<p className="mt-2 text-xs text-muted-foreground">Want to explore first? “Load sample stock” adds hypothetical examples that you can later replace.</p>}
   </div>}

   {visibleIngredients.length===0?<div className="px-5 py-10 text-center">
    <Search className="mx-auto mb-3 size-8 text-slate-300" aria-hidden="true"/>
    <p className="text-sm font-medium">{search?"No ingredients match that search.":"No ingredients need attention."}</p>
    <p className="mt-1 text-sm text-muted-foreground">{search?"Try another name or clear the search.":"Choose “All ingredients” to review every item."}</p>
    {(search||filter!=="all")&&<Button variant="outline" size="sm" className="mt-4" onClick={()=>{setSearch("");setFilter("all");}}>Show all ingredients</Button>}
   </div>:<div className="grid gap-3 p-3 sm:p-4 xl:grid-cols-2">
    {visibleIngredients.map(i=>{
     const batches=stock.batches.filter(b=>b.ingredientId===i.id);
     const pack=stock.packs.find(p=>p.ingredientId===i.id);
     const total=batches.reduce((sum,b)=>sum+baseQuantity(b.quantity,b.unit),0);
     const unit=i.kind==="weight"?"kg":i.kind==="liquid"?"L":"pieces";
     const amount=batches.length?`${Number((total/(i.kind==="count"?1:1000)).toFixed(3))} ${unit}`:"Not recorded";
     return <article key={i.id} className="min-w-0 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div className="min-w-0">
        <h3 className="font-semibold">{i.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{pack?`Purchase pack: ${pack.quantity} ${pack.unit} · ${pack.label}`:"Purchase pack not set"}</p>
       </div>
       <p className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${batches.length?"bg-blue-50 text-blue-800":"bg-background text-muted-foreground"}`}>{amount}</p>
      </div>
      <div className="mt-4 space-y-2">
       {batches.length===0&&<p className="rounded-lg bg-background px-3 py-3 text-sm text-muted-foreground">No stock recorded yet.</p>}
       {batches.map(b=>{
        const isExpired=!!b.expiryDate&&b.expiryDate<today;
        const isExpiring=!!b.expiryDate&&b.expiryDate>=today&&b.expiryDate<=soon;
        return <div key={b.id} className="rounded-lg bg-background p-3">
         <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 text-sm">
           <p className="font-medium">{b.quantity} {b.unit}<span className="font-normal text-muted-foreground"> · Counted {b.countDate}{b.isDemo?" · Sample":""}</span></p>
           <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {b.expiryDate?<>Expiry: {b.expiryDate}</>:<>Expiry date not recorded</>}
            {isExpired&&<span className="inline-flex items-center gap-1 font-medium text-red-700"><AlertTriangle size={13} aria-hidden="true"/>Past expiry · check before use</span>}
            {isExpiring&&<span className="inline-flex items-center gap-1 font-medium text-amber-700"><AlertTriangle size={13} aria-hidden="true"/>{b.expiryDate===today?"Expires today":"Expiring soon"}</span>}
           </p>
          </div>
          <Button variant="outline" size="sm" disabled={pending||!canManage} aria-label={`Edit ${i.name} batch counted ${b.countDate}`} onClick={()=>{setForm(makeForm(b));setError("");}}>Edit batch</Button>
         </div>
        </div>;
       })}
      </div>
     </article>;
    })}
   </div>}
  </section>

  <p className="mt-4 text-xs leading-5 text-muted-foreground">Totals include every recorded batch, even past-expiry stock. Confirm the date and condition on the package; sample dates are hypothetical. Stock is not automatically reduced when sales are entered.</p>
 </>;
}
