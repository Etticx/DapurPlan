import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRecipeStore } from "@/lib/db";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  if (!await getSession()) return NextResponse.json({error:"Sign in first."},{status:401});
  try {
    const {id}=await params;
    if (!getRecipeStore().list().some(r=>r.id===id)) return NextResponse.json({error:"Recipe not found."},{status:404});
    return NextResponse.json({history:getRecipeStore().history(id)},{headers:{"Cache-Control":"no-store"}});
  } catch {return NextResponse.json({error:"Could not load recipe history."},{status:503});}
}
