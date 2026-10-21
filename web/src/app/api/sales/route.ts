import demoSales from "@/lib/demo-sales-data.json";
import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {getSalesStore} from "@/lib/sales-db";
import {SalesInputError,salesDate} from "@/lib/sales";
import {SalesConflictError} from "@/lib/sales-store";
import {addDays,malaysiaDate} from "@/lib/inventory";
export const runtime="nodejs";
export async function GET(request:Request){
 if(!await getSession())return NextResponse.json({error:"Sign in first."},{status:401});
 try{const date=salesDate(new URL(request.url).searchParams.get("date")||malaysiaDate());const store=getSalesStore();return NextResponse.json({day:store.day(date),previousDay:store.day(addDays(date,-1)),recent:store.recent(),menuPrices:store.menuPrices()},{headers:{"Cache-Control":"no-store"}});}
 catch(e){return NextResponse.json({error:e instanceof SalesInputError?e.message:"Could not load sales. Please try again."},{status:e instanceof SalesInputError?400:503});}
}
export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:"Sign in first."},{status:401});
 try{const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Request not allowed."},{status:403});}catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
 let body;try{const text=await request.text();if(text.length>16000)return NextResponse.json({error:"Request too large."},{status:413});body=JSON.parse(text);}catch{return NextResponse.json({error:"Enter valid sales data."},{status:400});}
 try{return NextResponse.json(getSalesStore().save(body,session.username,body?.syntheticDemo===true?demoSales.days.find(d=>d.date===body.date)?.sourceDate:undefined));}catch(e){return NextResponse.json({error:e instanceof SalesInputError||e instanceof SalesConflictError?e.message:"Could not save sales. Your edits are still here; please try again."},{status:e instanceof SalesInputError?400:e instanceof SalesConflictError?409:503});}
}
