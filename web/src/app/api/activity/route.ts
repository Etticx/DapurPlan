import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {getActivityStore} from "@/lib/activity-db";
import {activityFilter,ActivityInputError} from "@/lib/activity";
export const runtime="nodejs";
export async function GET(request:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:"Sign in first."},{status:401});
 try{return NextResponse.json(getActivityStore().list(activityFilter(new URL(request.url).searchParams),session),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return NextResponse.json({error:e instanceof ActivityInputError?e.message:"Could not load activity. Please try again."},{status:e instanceof ActivityInputError?400:503});}
}
