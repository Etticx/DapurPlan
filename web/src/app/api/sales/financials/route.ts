import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {getSalesStore} from "@/lib/sales-db";
import {SalesInputError,type SalesTrendPeriod} from "@/lib/sales";
import {SalesConflictError} from "@/lib/sales-store";
export const runtime="nodejs";
export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:"Sign in first."},{status:401});
 if(session.role!=="owner")return NextResponse.json({error:"Only the owner can fill missing prices and costs."},{status:403});
 try{const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Request not allowed."},{status:403});}catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
 let body;try{const text=await request.text();if(text.length>2000)return NextResponse.json({error:"Request too large."},{status:413});body=JSON.parse(text);}catch{return NextResponse.json({error:"Choose a valid sales record."},{status:400});}
 try{const period=["daily","weekly","monthly"].includes(body?.trendPeriod)?body.trendPeriod as SalesTrendPeriod:"daily";return NextResponse.json(getSalesStore().fillMissingFinancials(body,session.username,period));}
 catch(e){if(!(e instanceof SalesInputError||e instanceof SalesConflictError))console.error("Sales financial correction failed",e);return NextResponse.json({error:e instanceof SalesInputError||e instanceof SalesConflictError?e.message:"Could not fill missing prices and costs. No changes were saved."},{status:e instanceof SalesInputError?400:e instanceof SalesConflictError?409:503});}
}
