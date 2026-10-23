import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const source=readFileSync(join(import.meta.dirname,"../src/components/sales-editor.tsx"),"utf8");

test("daily sales screen leads with the core entry and saves no date-specific demo data",()=>{
 assert.match(source,/<h1 className="text-3xl font-semibold tracking-tight">Daily sales<\/h1>/);
 assert.match(source,/<h2 className="text-lg font-semibold">Enter today’s sales<\/h2>/);
 assert.match(source,/Save sales/);
 assert.doesNotMatch(source,/markDemo|syntheticDemo|Agreed demo/);
});

test("financial breakdowns and historical detail are progressively disclosed",()=>{
 for(const section of ["Other daily expenses","Profit estimate","Sales trends","Previous sales records"]){
  assert.match(source,new RegExp(`<span className="block text-sm font-semibold">${section.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}<\\/span>`));
 }
 assert.match(source,/<details className="group mt-4/);
});

test("money formatting uses an explicit unavailable label instead of an incomplete placeholder",()=>{
 assert.match(source,/function formatMoney\(cents:number\|null\)\{return cents===null\?"Not available"/);
 assert.match(source,/function summaryValue\(value:number\|null\)\{return value===null\?"Not available"/);
});

test("financial details distinguish incomplete expenses and negative contributions",()=>{
 assert.match(source,/data\.expenseVersion>0&&!expensesDirty/);
 assert.match(source,/Save an empty list to confirm no other expenses were recorded/);
 assert.match(source,/itemFinancial\.contributionCents<0\?"text-red-700":""/);
 assert.match(source,/Contribution margin/);
 assert.match(source,/unrecorded expenses are excluded/);
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
