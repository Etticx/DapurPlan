import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const source=readFileSync(join(import.meta.dirname,"../src/components/sales-editor.tsx"),"utf8");
const recipesSource=readFileSync(join(import.meta.dirname,"../src/components/recipe-editor.tsx"),"utf8");
const inventorySource=readFileSync(join(import.meta.dirname,"../src/components/inventory-editor.tsx"),"utf8");

test("daily sales screen leads with the core entry and saves no date-specific demo data",()=>{
 assert.match(source,/<h1 className="text-3xl font-semibold tracking-tight">Daily sales<\/h1>/);
 assert.match(source,/draft\.date===malaysiaDate\(\)&&!draft\.version\?"Enter today’s sales"/);
 assert.match(source,/Save sales/);
 assert.doesNotMatch(source,/markDemo|syntheticDemo|Agreed demo/);
});

test("sales entry exposes business date, a scan-friendly table, validation and explicit actions",()=>{
 assert.match(source,/Business date · \{shortDate\(draft\.date\)\} \(Malaysia\)/);
 assert.match(source,/<table className="w-full min-w-\[680px\] text-left text-sm">/);
 assert.match(source,/Selling price/);
 assert.match(source,/aria-invalid=\{Boolean\(fieldError\)\}/);
 assert.match(source,/Enter a whole number from 0 to 1,000,000/);
 assert.match(source,/loadingDate\?"Loading…":busy\?"Saving…"/);
 assert.match(source,/role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">\{loadingMessage\}/);
 assert.match(source,/draft\.version\?"Save changes":"Save sales"/);
 assert.match(source,/<RotateCcw aria-hidden="true"\/>Cancel/);
 assert.match(source,/saveInProgress\.current/);
 assert.match(source,/window\.confirm\("Discard your unsaved sales changes\?"\)/);
});

test("daily sales content follows the requested hierarchy without repeated summary cards",()=>{
 const sections=["<h1 className=","<form onSubmit={saveSales}","aria-label=\"Sales summary\"","id=\"profit-estimate-heading\"","id=\"menu-financials-heading\"","Historical sales records"].map(marker=>source.indexOf(marker));
 assert.ok(sections.every(index=>index>=0));
 assert.deepEqual([...sections],[...sections].sort((a,b)=>a-b));
 assert.match(source,/Ingredient cost of sales/);
 assert.match(source,/Gross profit/);
 assert.doesNotMatch(source,/Compared with previous day/);
 assert.match(source,/Sales trends/);
});

test("financial breakdowns and historical detail are progressively disclosed",()=>{
 for(const section of ["Other daily expenses","Sales trends","Historical sales records"]){
  assert.match(source,new RegExp(`<span className="block text-sm font-semibold">${section.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}<\\/span>`));
 }
 assert.match(source,/id="profit-estimate-heading" className="text-lg font-semibold">Profit estimate/);
 assert.match(source,/id="menu-financials-heading" className="text-lg font-semibold">Menu-level financial details/);
 assert.match(source,/<details className="group mt-4/);
});

test("saved sales versions expose timestamps, snapshots and non-destructive recovery",()=>{
 assert.match(source,/Version \{day\.version\}/);
 assert.match(source,/net estimate unavailable; open to review missing inputs/);
 assert.match(source,/Version history for \{shortDate\(draft\.date\)\}/);
 assert.match(source,/Latest saved version · v\$\{entry\.version\}/);
 assert.match(source,/Earlier version · v\$\{entry\.version\}/);
 assert.match(source,/Saved selling price/);
 assert.match(source,/Saved ingredient cost \/ serving/);
 assert.match(source,/restored from v\$\{entry\.restoredFromVersion\}/);
 assert.match(source,/fetch\("\/api\/sales\/history"/);
 assert.match(source,/Current and earlier versions will remain in history/);
});

test("money formatting uses an explicit unavailable label instead of an incomplete placeholder",()=>{
 assert.match(source,/function formatMoney\(cents:number\|null\)\{return cents===null\?"Not available"/);
 assert.match(source,/function summaryValue\(value:number\|null\)\{return value===null\?"Not available"/);
});

test("financial details distinguish incomplete expenses and negative contributions",()=>{
 assert.match(source,/data\.expenseVersion>0&&!expensesDirty/);
 assert.match(source,/Save an empty list to confirm no other expenses were recorded/);
 assert.match(source,/itemFinancial\.contributionCents<0\?"text-red-700":""/);
 assert.match(source,/Negative contribution/);
 assert.match(source,/role="status">Cost incomplete/);
 assert.match(source,/Review \{menu\.name\} recipe/);
 assert.match(source,/recipes\?menu=\$\{encodeURIComponent\(menu\.id\)\}/);
 assert.match(recipesSource,/new URLSearchParams\(window\.location\.search\)\.get\("menu"\)/);
 assert.match(source,/expenses not recorded here are excluded/);
 assert.match(source,/Other expenses included/);
 assert.match(source,/expensesRecorded\?includedExpenses\.length===0/);
 assert.match(source,/expensesDirty&&<p className="mt-2 text-sm text-amber-800">Expense changes are unsaved and are not included in this estimate/);
 assert.match(source,/Estimate incomplete: check these required inputs/);
 assert.match(source,/ingredient price for \$\{ingredient\.name\} is missing/);
 assert.match(source,/inventory\?ingredient=\$\{encodeURIComponent\(ingredient\.ingredientId\)\}#ingredient-price-setup/);
 assert.match(source,/negative value means the estimated cost exceeds revenue; it does not by itself mean the selling price is wrong/);
 assert.match(source,/calculated gross profit minus the other expenses saved for this date/);
 assert.match(source,/Calculated from quantities entered and saved selling prices/);
 assert.match(source,/expensesRef\.current\.open=true/);
});

test("ingredient-price warnings navigate to and focus the matching setup field",()=>{
 assert.match(inventorySource,/ref=\{ingredientPriceSetupRef\} id="ingredient-price-setup"/);
 assert.match(inventorySource,/if\(window\.location\.hash!=="#ingredient-price-setup"\)return/);
 assert.match(inventorySource,/setup\.open=true/);
 assert.match(inventorySource,/document\.getElementById\(`price-\$\{ingredientId\}`\)/);
 assert.match(inventorySource,/target\?\.focus\(\{preventScroll:true\}\)/);
});

test("serving and expense fields use purpose-built text keyboards and quick steppers",()=>{
 assert.match(source,/type="text" pattern="\[0-9\]\*" maxLength=\{7\} inputMode="numeric"/);
 assert.match(source,/aria-label=\{`Decrease \$\{menu\.name\} servings`\}/);
 assert.match(source,/aria-label=\{`Increase \$\{menu\.name\} servings`\}/);
 assert.match(source,/type="text" inputMode="decimal" autoComplete="off" maxLength=\{10\}/);
 assert.match(source,/value=\{expense\.amount\} onChange=\{event=>editExpense\(expense\.id,\{amount:event\.target\.value\}\)\}/);
});

test("expense amount keeps a fixed desktop width and stacks before the desktop breakpoint",()=>{
 assert.match(source,/lg:grid-cols-\[minmax\(0,1fr\)_220px_minmax\(0,1fr\)_40px\]/);
 assert.match(source,/className="mt-1\.5 flex h-11 w-full items-center/);
 assert.match(source,/shrink-0 pl-3 text-sm font-medium text-muted-foreground">RM/);
});
