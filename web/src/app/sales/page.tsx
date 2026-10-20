import {malaysiaDate} from "@/lib/inventory";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { SalesEditor } from "@/components/sales-editor";
import { getSession } from "@/lib/auth";
import { getSalesStore } from "@/lib/sales-db";
export const runtime="nodejs";
export const metadata = {title:"Daily sales | DapurPlan"};
export default async function SalesPage() {
  if (!await getSession()) redirect("/login");
  return <div className="min-h-svh lg:flex"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4">Skip to content</a><WorkspaceSidebar active="Daily sales" /><div className="min-w-0 flex-1 lg:ml-60"><header className="flex h-20 items-center justify-between border-b border-border bg-white/80 px-5 sm:px-8"><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Workspace</span><ChevronRight className="size-3.5 text-slate-400" aria-hidden="true" /><span className="font-medium">Daily sales</span></div><LogoutButton /></header><main id="main-content" className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8"><SalesEditor initialData={{day:getSalesStore().day(malaysiaDate()),recent:getSalesStore().recent()}} /></main></div></div>;
}
