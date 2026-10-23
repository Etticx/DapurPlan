import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {getSalesStore} from "@/lib/sales-db";
import {SalesInputError,type SalesTrendPeriod} from "@/lib/sales";
import {SalesConflictError} from "@/lib/sales-store";
export const runtime="nodejs";

export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:"Sign in first."},{status:401});
 try{const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Request not allowed."},{status:403});}catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
 let body;try{const text=await request.text();if(text.length>2000)return NextResponse.json({error:"Request too large."},{status:413});body=JSON.parse(text);}catch{return NextResponse.json({error:"Choose a valid sales version."},{status:400});}
 try{
  const period=["daily","weekly","monthly"].includes(body?.trendPeriod)?body.trendPeriod as SalesTrendPeriod:"daily";
  return NextResponse.json(getSalesStore().restore(body,session.username,period));
 }catch(e){
  return NextResponse.json({error:e instanceof SalesInputError||e instanceof SalesConflictError?e.message:"Could not restore sales. No changes were saved."},{status:e instanceof SalesInputError?400:e instanceof SalesConflictError?409:503});
 }
}
