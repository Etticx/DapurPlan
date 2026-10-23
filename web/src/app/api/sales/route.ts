import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {getSalesStore} from "@/lib/sales-db";
import {SalesInputError,salesDate,type SalesTrendPeriod} from "@/lib/sales";
import {SalesConflictError} from "@/lib/sales-store";
import {malaysiaDate} from "@/lib/inventory";
export const runtime="nodejs";
export async function GET(request:Request){
 if(!await getSession())return NextResponse.json({error:"Sign in first."},{status:401});
 try{const url=new URL(request.url);const date=salesDate(url.searchParams.get("date")||malaysiaDate());const requestedPeriod=url.searchParams.get("trend")||"daily";if(!["daily","weekly","monthly"].includes(requestedPeriod))throw new SalesInputError("Choose a daily, weekly or monthly trend.");return NextResponse.json(getSalesStore().getData(date,requestedPeriod as SalesTrendPeriod),{headers:{"Cache-Control":"no-store"}});}
 catch(e){if(!(e instanceof SalesInputError))console.error("Sales load failed",e);return NextResponse.json({error:e instanceof SalesInputError?e.message:"Could not load sales. Please try again."},{status:e instanceof SalesInputError?400:503});}
}
export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:"Sign in first."},{status:401});
 try{const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Request not allowed."},{status:403});}catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
 let body;try{const text=await request.text();if(text.length>16000)return NextResponse.json({error:"Request too large."},{status:413});body=JSON.parse(text);}catch{return NextResponse.json({error:"Enter valid sales data."},{status:400});}
 try{const period=["daily","weekly","monthly"].includes(body?.trendPeriod)?body.trendPeriod as SalesTrendPeriod:"daily";return NextResponse.json(getSalesStore().save(body,session.username,undefined,period));}catch(e){if(!(e instanceof SalesInputError||e instanceof SalesConflictError))console.error("Sales save failed",e);return NextResponse.json({error:e instanceof SalesInputError||e instanceof SalesConflictError?e.message:"Could not save sales. Your edits are still here; please try again."},{status:e instanceof SalesInputError?400:e instanceof SalesConflictError?409:503});}
}
