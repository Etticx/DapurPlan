import {test} from "node:test";
import assert from "node:assert/strict";
import {CsvInputError,csvBoolean,csvDecimal,csvInteger,parseCsv,requireCsvColumns,stringifyCsv} from "../src/lib/spreadsheet";

test("CSV round trips quoted text, commas, newlines, formula-looking text, and booleans",()=>{
 const headers=["text","amount","enabled"];
 const text='=HYPERLINK("https://example.test","open"), kitchen\nsecond line';
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
