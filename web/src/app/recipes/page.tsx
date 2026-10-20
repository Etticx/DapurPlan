import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { RecipeEditor } from "@/components/recipe-editor";
import { getSession } from "@/lib/auth";
import { getRecipeStore } from "@/lib/db";
export const runtime="nodejs";
export const metadata = {title:"Recipes | DapurPlan"};
export default async function RecipesPage() {
  const session=await getSession();
  if (!session) redirect("/login");
  return <div className="min-h-svh lg:flex"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4">Skip to content</a><WorkspaceSidebar active="Recipes" /><div className="min-w-0 flex-1 lg:ml-60"><header className="flex h-20 items-center justify-between border-b border-border bg-white/80 px-5 sm:px-8"><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Workspace</span><ChevronRight className="size-3.5 text-slate-400" aria-hidden="true" /><span className="font-medium">Recipes</span></div><LogoutButton /></header><main id="main-content" className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8"><RecipeEditor canManage={session.role==="owner"} initialRecipes={getRecipeStore().list()} /></main></div></div>;
}
