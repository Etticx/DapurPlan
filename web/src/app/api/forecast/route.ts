import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {getForecastStore} from "@/lib/forecast-db";
import {requestForecast,ForecastServiceError} from "@/lib/forecast";
import {ForecastHistoryError} from "@/lib/forecast-store";
export const runtime="nodejs";
export async function GET(){if(!await getSession())return NextResponse.json({error:"Sign in first."},{status:401});try{return NextResponse.json(getForecastStore().view(),{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"Could not load forecast."},{status:503});}}
export async function POST(request:Request){
 const session=await getSession();if (!session) return NextResponse.json({error:"Sign in first."},{status:401});
  if (session.role!=="owner") return NextResponse.json({error:"Only the owner can perform this action."},{status:403});
 try{const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Request not allowed."},{status:403});}catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
 try{const store=getForecastStore();const prepared=store.prepare();if(prepared.missing.length)return NextResponse.json({error:"Complete seven days of sales for all five menus before generating.",missing:prepared.missing},{status:422});const result=await requestForecast(prepared.inputs);store.save(prepared,result,session.username);return NextResponse.json(store.view());}
 catch(e){return NextResponse.json({error:e instanceof ForecastServiceError||e instanceof ForecastHistoryError?e.message:"Could not save the forecast. Please try again."},{status:e instanceof ForecastHistoryError?409:503});}
}
