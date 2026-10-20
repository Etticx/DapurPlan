import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {getInventoryStore} from "@/lib/inventory-db";
import {InventoryInputError} from "@/lib/inventory";
import {InventoryConflictError,InventoryPermissionError} from "@/lib/inventory-store";
export const runtime="nodejs";
export async function GET(){if(!await getSession())return NextResponse.json({error:"Sign in first."},{status:401});return NextResponse.json(getInventoryStore().list(),{headers:{"Cache-Control":"no-store"}});}
export async function POST(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:"Sign in first."},{status:401});
 const origin=request.headers.get("origin");try{if(origin&&new URL(origin).host!==request.headers.get("host"))return NextResponse.json({error:"Request not allowed."},{status:403});}catch{return NextResponse.json({error:"Invalid origin."},{status:403});}
 let body;try{const text=await request.text();if(text.length>16000)return NextResponse.json({error:"Request too large."},{status:413});body=JSON.parse(text);}catch{return NextResponse.json({error:"Enter valid stock details."},{status:400});}
 if(body?.action==="seed-demo"&&session.role!=="owner")return NextResponse.json({error:"Only the owner can load demo stock."},{status:403});
 try{return NextResponse.json(body?.action==="seed-demo"?getInventoryStore().seed(session.username):getInventoryStore().save(body,session.username));}
 catch(error){if(error instanceof InventoryPermissionError)return NextResponse.json({error:error.message},{status:403});if(error instanceof InventoryInputError)return NextResponse.json({error:error.message},{status:400});if(error instanceof InventoryConflictError)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({error:"Stock could not be saved. Please try again."},{status:503});}
}
