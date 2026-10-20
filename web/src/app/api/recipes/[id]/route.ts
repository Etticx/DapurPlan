import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRecipeStore } from "@/lib/db";
import { RecipeInputError } from "@/lib/recipe-validation";
import { RecipeConflictError, RecipeNotFoundError } from "@/lib/recipe-store";
export const runtime="nodejs";
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}) {
  const session=await getSession();
  if (!session) return NextResponse.json({error:"Sign in first."},{status:401});
  if (session.role!=="owner") return NextResponse.json({error:"Only the owner can perform this action."},{status:403});
  const origin=request.headers.get("origin");
  try {if (origin && new URL(origin).host!==request.headers.get("host")) return NextResponse.json({error:"Request not allowed."},{status:403});}
  catch {return NextResponse.json({error:"Invalid origin."},{status:403});}
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({error:"Send recipe data as JSON."},{status:415});
  let body:unknown;
  try {
    const text=await request.text();
    if (text.length>32000) return NextResponse.json({error:"Recipe is too large."},{status:413});
    body=JSON.parse(text);
  } catch {return NextResponse.json({error:"Enter valid recipe data."},{status:400});}
  try {
    const {id}=await params;
    return NextResponse.json({recipe:getRecipeStore().update(id,body,session.username)},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    if (error instanceof RecipeInputError) return NextResponse.json({error:error.message},{status:400});
    if (error instanceof RecipeConflictError) return NextResponse.json({error:error.message},{status:409});
    if (error instanceof RecipeNotFoundError) return NextResponse.json({error:error.message},{status:404});
    return NextResponse.json({error:"Could not save the recipe. Your changes are still here; please try again."},{status:503});
  }
}
