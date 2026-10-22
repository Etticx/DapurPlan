"use client";

import {useState,type FormEvent} from "react";
import {ArrowDownToLine,ArrowUpFromLine,FileSpreadsheet,Info} from "lucide-react";
import {Button} from "@/components/ui/button";

type DataType="sales"|"expenses"|"inventory"|"recipes"|"ingredient-prices"|"planning";
type ImportResult={imported:number;errors:string[]};
const sections:{type:DataType;title:string;description:string;exportLabel:string;editable:boolean;access:string;tip:string}[]=[
 {type:"sales",title:"Daily sales",description:"One row per menu item and date. Keep all five menu rows for each date together when editing.",exportLabel:"Download sales CSV",editable:true,access:"Owners and staff",tip:"Leave servings blank when that menu was not entered; use 0 for confirmed zero sales. sold_out accepts true or false."},
 {type:"expenses",title:"Daily expenses",description:"Edit the complete expense list for each date. Import replaces that date’s list.",exportLabel:"Download expenses CSV",editable:true,access:"Owners and staff",tip:"Add rows to add expenses. To remove all expenses for a date, replace its rows with one row whose operation is clear-date and keep the date’s version."},
 {type:"inventory",title:"Inventory batches",description:"Each row is one batch. Existing batch IDs update that batch; blank IDs add a new batch.",exportLabel:"Download inventory CSV",editable:true,access:"Owners and staff can add; owners can correct",tip:"Do not remove rows to delete stock. Set quantity to 0 to mark a batch exhausted. Stock units and purchase pack units must match the ingredient."},
 {type:"ingredient-prices",title:"Ingredient prices",description:"Owner-managed recipe cost inputs, in RM per displayed unit.",exportLabel:"Download ingredient prices CSV",editable:true,access:"Owners only",tip:"Keep the ingredient ID, unit, quantity, and version columns. Leave cost_rm blank to clear a price."},
 {type:"recipes",title:"Recipes and menu prices",description:"One row per recipe ingredient. A recipe import replaces that recipe’s ingredient list and menu price.",exportLabel:"Download recipes CSV",editable:true,access:"Owners only",tip:"Keep every ingredient row for a recipe. Removing a row removes that ingredient from the recipe. Ingredient IDs, quantities and units must be valid."},
 {type:"planning",title:"Forecast and preparation plan",description:"Download the latest saved forecast, preparation quantities, and ingredient needs for review.",exportLabel:"Download planning CSV",editable:false,access:"Export only",tip:"Planning is derived from sales, recipes and stock. Change those source records in DapurPlan or their CSV files, then regenerate the forecast and plan in DapurPlan."},
];

export function SpreadsheetEditor({canManage}:{canManage:boolean}){
 const [pending,setPending]=useState<DataType|null>(null);
 const [results,setResults]=useState<Partial<Record<DataType,ImportResult>>>({});
 const [errors,setErrors]=useState<Partial<Record<DataType,string>>>({});
 async function importFile(type:DataType,event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const form=event.currentTarget;
  const input=form.elements.namedItem("file");
  if(!(input instanceof HTMLInputElement)||!input.files?.[0]){
   setErrors(previous=>({...previous,[type]:"Choose a CSV file first."}));return;
  }
  const file=input.files[0];
  if(!file.name.toLowerCase().endsWith(".csv")){
   setErrors(previous=>({...previous,[type]:"Choose a .csv file."}));return;
  }
  const body=new FormData();body.set("type",type);body.set("file",file);
  setPending(type);setErrors(previous=>({...previous,[type]:""}));setResults(previous=>({...previous,[type]:undefined}));
  try{
   const response=await fetch("/api/spreadsheet",{method:"POST",body});
   const result=await response.json() as ImportResult&{error?:string};
   if(!response.ok&&response.status!==207)throw new Error(result.error||"Could not import CSV.");
   setResults(previous=>({...previous,[type]:result}));
   if(result.errors.length)setErrors(previous=>({...previous,[type]:"Some rows were not imported. Review the details below before editing or retrying."}));
   form.reset();
  }catch(error){
   setErrors(previous=>({...previous,[type]:error instanceof Error?error.message:"Could not import CSV."}));
  }finally{
   setPending(null);
  }
 }

 return <div className="mx-auto max-w-5xl">
  <header>
   <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-blue-600">ONE BUSINESS, TWO WAYS TO WORK</p>
   <h1 className="text-3xl font-semibold tracking-tight">Spreadsheet data</h1>
   <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Download a current CSV, make familiar edits in a spreadsheet, then import it back. DapurPlan remains the source of truth; imported records update the same data used by reports and forecasts.</p>
  </header>

  <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
   <div className="flex gap-3">
    <div className="mt-0.5 text-blue-700"><Info size={19} aria-hidden="true"/></div>
    <div className="text-sm leading-6 text-secondary-foreground">
     <p className="font-semibold text-foreground">CSV exchange, not live sync</p>
     <p className="mt-1">This first version uses separate CSV files, not a continuously connected workbook. Download the latest file before editing; import checks record versions and rejects stale changes instead of silently overwriting newer DapurPlan data.</p>
     <p className="mt-1 text-xs">Keep the ID and version columns intact. Import only changed files. Some rows can save while other rows fail; every failure is reported with a row number. Export a fresh file before resolving a conflict.</p>
    </div>
   </div>
  </section>

  <div className="mt-6 grid gap-4">
   {sections.map(section=>{
    const allowed=section.editable&&(section.access==="Owners and staff"||section.type==="inventory"||canManage);
    const result=results[section.type];
    return <section key={section.type} className="rounded-2xl border border-border bg-white p-5 sm:p-6">
     <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
       <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileSpreadsheet size={20} aria-hidden="true"/></div>
       <div>
        <h2 className="font-semibold">{section.title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{section.description}</p>
        <p className="mt-2 text-xs font-medium text-slate-600">{section.access}</p>
       </div>
      </div>
      <a href={`/api/spreadsheet?type=${section.type}`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
       <ArrowDownToLine size={16} aria-hidden="true"/>{section.exportLabel}
      </a>
     </div>
     <p className="mt-4 rounded-lg bg-background px-3 py-2.5 text-xs leading-5 text-muted-foreground">{section.tip}</p>
     {section.editable&&<div className="mt-4">
      {allowed?<form onSubmit={event=>void importFile(section.type,event)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
       <label className="min-w-0 flex-1 text-xs font-medium text-foreground">Import edited CSV
        <input name="file" type="file" accept=".csv,text/csv" required disabled={pending!==null} className="mt-2 block w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:opacity-60"/>
       </label>
       <Button size="sm" disabled={pending!==null}><ArrowUpFromLine aria-hidden="true"/>{pending===section.type?"Importing…":"Import CSV"}</Button>
      </form>:<p className="mt-4 text-xs text-muted-foreground">Only owners can import recipe and ingredient cost changes. Staff can still download these records.</p>}
      {errors[section.type]&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-destructive">{errors[section.type]}</p>}
      {result&&<div role={result.errors.length?"alert":"status"} className={`mt-3 rounded-lg p-3 text-sm ${result.errors.length?"bg-amber-50 text-amber-900":"bg-green-50 text-green-900"}`}>
       <p className="font-semibold">{result.imported} rows imported{result.errors.length?`; ${result.errors.length} rows need attention.`:" successfully."}</p>
       {result.errors.length>0&&<ul className="mt-2 list-inside list-disc space-y-1 text-xs">{result.errors.slice(0,20).map((error,index)=><li key={`${index}-${error}`}>{error}</li>)}</ul>}
       {result.errors.length>20&&<p className="mt-2 text-xs">Showing the first 20 errors.</p>}
      </div>}
     </div>}
    </section>;
   })}
  </div>
 </div>;
}
