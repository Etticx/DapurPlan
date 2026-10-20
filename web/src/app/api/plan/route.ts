import {NextResponse} from "next/server";
import {getOwnerSession} from "@/lib/auth";
import {getPlanStore} from "@/lib/plan-db";
import {PlanInputError} from "@/lib/planning";
import {PlanConflictError} from "@/lib/plan-store";
export const runtime="nodejs";
export async function GET(){if(!await getOwnerSession())return NextResponse.json({error:"Sign in as owner."},{status:401});try{return NextResponse.json(getPlanStore().view(),{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"Could not load the plan."},{status:503});}}
export async function POST(request:Request){
 const owner=await getOwnerSession();if(!owner||owner.role!=="owner")return NextResponse.json({error:"Sign in as owner."},{status:401});
 try{const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Request not allowed."},{status:403});}catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
 let body;try{const raw=await request.text();if(raw.length>16000)return NextResponse.json({error:"Plan too large."},{status:413});body=JSON.parse(raw);}catch{return NextResponse.json({error:"Enter valid plan details."},{status:400});}
 try{return NextResponse.json(getPlanStore().save(body,owner.username));}catch(e){return NextResponse.json({error:e instanceof PlanInputError||e instanceof PlanConflictError?e.message:"The plan could not be saved. Please try again."},{status:e instanceof PlanInputError?400:e instanceof PlanConflictError?409:503});}
}
