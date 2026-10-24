import {test} from "node:test";
import assert from "node:assert/strict";
import {CsvInputError,CsvPayloadTooLargeError,csvBoolean,csvDecimal,csvInteger,csvMoneyCents,parseCsv,readBoundedBody,requireCsvColumns,stringifyCsv} from "../src/lib/spreadsheet";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {openSalesStore} from "../src/lib/sales-store";
import {openInventoryStore} from "../src/lib/inventory-store";
import {salesMenus} from "../src/lib/sales";
import {malaysiaDate} from "../src/lib/inventory";
import {importSalesRows} from "../src/lib/sales-import";

test("CSV round trips quoted text, commas, newlines, formula-looking text, and booleans",()=>{
 const headers=["text","amount","enabled"];
 const text=' \t=HYPERLINK("https://example.test","open"), kitchen\nsecond line';
 const csv=stringifyCsv(headers,[{text,amount:12.5,enabled:true}]);
 assert.deepEqual(parseCsv(csv),{headers,rows:[{text,amount:"12.5",enabled:"true"}]});
});

test("CSV parser rejects malformed rows and unsafe header ambiguity",()=>{
 assert.throws(()=>parseCsv("a,b\n1"),CsvInputError);
 assert.throws(()=>parseCsv('a,b\n"open,1'),CsvInputError);
 assert.throws(()=>parseCsv("a,a\n1,2"),CsvInputError);
 assert.throws(()=>parseCsv('a,b\nx"y,1'),CsvInputError);
});

test("CSV import helpers validate values and required columns",()=>{
 assert.equal(csvInteger("0","version",{max:3}),0);
 assert.equal(csvInteger("","servings",{blank:true}),null);
 assert.throws(()=>csvInteger("1.5","servings"),CsvInputError);
 assert.equal(csvDecimal(".25","quantity",{min:0.001}),0.25);
 assert.equal(csvDecimal("","price",{blank:true}),null);
 assert.throws(()=>csvDecimal("-1","price"),CsvInputError);
 assert.equal(csvBoolean("true","sold_out"),true);
 assert.equal(csvBoolean("0","sold_out"),false);
 assert.throws(()=>csvBoolean("yes","sold_out"),CsvInputError);
 assert.throws(()=>requireCsvColumns(["date"],["date","version"]),CsvInputError);
});

test("CSV money parsing rejects values that would be rounded to a different amount",()=>{
 assert.equal(csvMoneyCents("12","amount"),1200);
 assert.equal(csvMoneyCents(".5","amount"),50);
 assert.equal(csvMoneyCents("","amount",{blank:true}),null);
 assert.throws(()=>csvMoneyCents("1.005","amount"),CsvInputError);
 assert.throws(()=>csvMoneyCents("1000000.01","amount"),CsvInputError);
});

test("spreadsheet upload bodies are size-limited before parsing",async()=>{
 const bytes=new TextEncoder().encode("12345");
 const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes);controller.close();}});
 await assert.rejects(readBoundedBody(body,4),CsvPayloadTooLargeError);
 const accepted=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes.subarray(0,4));controller.close();}});
 assert.deepEqual(await readBoundedBody(accepted,4),bytes.subarray(0,4));
});

test("reimporting an unchanged sales CSV is idempotent and does not alter inventory",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dapur-sales-csv-"));const path=join(dir,"test.sqlite");
 const sales=openSalesStore(path);const inventory=openInventoryStore(path);
 try{
  const date=malaysiaDate();const inventoryBefore=inventory.list();
  const csv=["date,version,menu_id,servings,sold_out",...salesMenus.map((menu,index)=>`${date},0,${menu.id},${index===0?2:""},false`)].join("\n");
  const rows=parseCsv(csv).rows;
  assert.deepEqual(importSalesRows(rows,"owner",sales),{imported:salesMenus.length,errors:[]});
  assert.equal(sales.day(date).version,1);assert.equal(sales.day(date).lines[0].quantity,2);
  assert.deepEqual(importSalesRows(rows,"owner",sales),{imported:salesMenus.length,errors:[]});
  assert.equal(sales.day(date).version,1);assert.equal(sales.day(date).lines[0].quantity,2);
  assert.equal(sales.history(date).length,1);
  const modifiedRows=rows.map(row=>({...row,servings:row.menu_id===salesMenus[0].id?"4":row.servings}));
  const stale=importSalesRows(modifiedRows,"owner",sales);
  assert.equal(stale.imported,0);assert.equal(stale.errors.length,salesMenus.length);
  assert.equal(sales.day(date).version,1);assert.equal(sales.day(date).lines[0].quantity,2);
  assert.equal(sales.history(date).length,1);assert.deepEqual(inventory.list(),inventoryBefore);
 }finally{sales.close();inventory.close();rmSync(dir,{recursive:true,force:true});}
});
