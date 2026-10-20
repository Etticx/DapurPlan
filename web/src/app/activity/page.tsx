import {redirect} from "next/navigation";
import {ChevronRight} from "lucide-react";
import {getSession} from "@/lib/auth";
import {getActivityStore} from "@/lib/activity-db";
import {activityFilter} from "@/lib/activity";
import {ActivityLog} from "@/components/activity-log";
import {WorkspaceSidebar} from "@/components/workspace-sidebar";
import {LogoutButton} from "@/components/logout-button";
export const runtime="nodejs";
export const metadata={title:"Activity log | DapurPlan"};
export default async function ActivityPage(){
 const session=await getSession();if(!session)redirect("/login");
 const initial=getActivityStore().list(activityFilter(new URLSearchParams()),session);
 return <div className="min-h-svh lg:flex"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4">Skip to content</a><WorkspaceSidebar active="Activity log"/><div className="min-w-0 flex-1 lg:ml-60"><header className="flex h-20 items-center justify-between border-b border-border bg-white/80 px-5 sm:px-8"><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Workspace</span><ChevronRight className="size-3.5 text-slate-400" aria-hidden="true"/><span className="font-medium">Activity log</span></div><LogoutButton/></header><main id="main-content" className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8"><ActivityLog initial={initial} isOwner={session.role==="owner"}/></main></div></div>;
}
