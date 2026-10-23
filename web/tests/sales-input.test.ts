import {test} from "node:test";
import assert from "node:assert/strict";
import {MAX_EXPENSE_CENTS,MAX_SALES_SERVINGS,parseExpenseAmount,parseServingsInput} from "../src/lib/sales-input";

test("serving input accepts blanks and whole counts within the supported range",()=>{
 assert.equal(parseServingsInput(""),null);
 assert.equal(parseServingsInput("0"),0);
 assert.equal(parseServingsInput("125"),125);
 assert.equal(parseServingsInput(String(MAX_SALES_SERVINGS)),MAX_SALES_SERVINGS);
 for(const invalid of ["-1","1.5","1,000","abc","1000001","12345678"])assert.equal(parseServingsInput(invalid),undefined);
});

test("expense input retains cent precision and accepts either decimal separator",()=>{
 assert.equal(parseExpenseAmount(""),null);
 assert.equal(parseExpenseAmount("0.01"),1);
 assert.equal(parseExpenseAmount("12.3"),1230);
 assert.equal(parseExpenseAmount("12,34"),1234);
 assert.equal(parseExpenseAmount("1000000.00"),MAX_EXPENSE_CENTS);
 for(const invalid of ["-1","1.001","1,234.56","abc","0","1000000.01"])assert.equal(parseExpenseAmount(invalid),null);
});
