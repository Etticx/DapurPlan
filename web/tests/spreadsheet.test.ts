import {test} from "node:test";
import assert from "node:assert/strict";
import {CsvInputError,CsvPayloadTooLargeError,csvBoolean,csvDecimal,csvInteger,csvMoneyCents,parseCsv,readBoundedBody,requireCsvColumns,stringifyCsv} from "../src/lib/spreadsheet";

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
