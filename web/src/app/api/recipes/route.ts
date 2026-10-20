import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRecipeStore } from "@/lib/db";
export const runtime="nodejs";
export async function GET() {
  if (!await getSession()) return NextResponse.json({error:"Sign in first."},{status:401});
  try {return NextResponse.json({recipes:getRecipeStore().list()},{headers:{"Cache-Control":"no-store"}});}
  catch {return NextResponse.json({error:"Could not load recipes. Please try again."},{status:503});}
}
