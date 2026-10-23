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
