import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {ExpenseInputError,type SalesTrendPeriod} from "@/lib/sales";
import {getSalesStore} from "@/lib/sales-db";
import {ExpenseConflictError} from "@/lib/sales-store";
export const runtime="nodejs";
export async function POST(request:Request){
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sign in first."},{status:401});
 try{const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Request not allowed."},{status:403});}
 catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
 let body:unknown;
 try{const text=await request.text();if(text.length>16000)return NextResponse.json({error:"Request too large."},{status:413});body=JSON.parse(text);}
 catch{return NextResponse.json({error:"Enter valid expense data."},{status:400});}
 try{const period=["daily","weekly","monthly"].includes((body as {trendPeriod?:string})?.trendPeriod??"")?(body as {trendPeriod:SalesTrendPeriod}).trendPeriod:"daily";return NextResponse.json(getSalesStore().saveExpenses(body,session.username,period));}
 catch(error){
  if(error instanceof ExpenseInputError)return NextResponse.json({error:error.message},{status:400});
  if(error instanceof ExpenseConflictError)return NextResponse.json({error:error.message},{status:409});
  return NextResponse.json({error:"Expenses could not be saved. Your edits are still here; please try again."},{status:503});
 }
}
