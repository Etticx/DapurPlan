import { getForecastStore } from "@/lib/forecast-db";
import { getSalesStore } from "@/lib/sales-db";
import { malaysiaDate } from "@/lib/inventory";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, BookOpen, CalendarDays, CheckCheck, ChevronRight, ClipboardList, Clock3, History, LayoutDashboard, Leaf, Package, Plus, ShieldCheck, ShoppingBasket, Sparkles, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { getOwnerSession } from "@/lib/auth";

export const metadata = { title: "Overview | DapurPlan" };



function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-6 py-9 text-center">
    <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-blue-500"><Icon className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
    <p className="text-sm font-medium">{title}</p>
    <p className="mt-2 max-w-64 text-xs leading-5 text-muted-foreground">{description}</p>
  </div>;
}

export default async function HomePage() {
  const session = await getOwnerSession();
  if (!session) redirect("/login");

  const forecast = getForecastStore().view();
  const forecastTotal = forecast.latest && !forecast.stale ? forecast.latest.predictions.reduce((sum, p) => sum + p.predictedServings, 0) : null;
  const todaySales = getSalesStore().day(malaysiaDate());
  const entered = todaySales.lines.filter(line => line.quantity !== null).length;
  const total = todaySales.lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  return <div className="min-h-svh lg:flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-4">Skip to content</a>
    <WorkspaceSidebar active="Overview" />

    <div className="min-w-0 flex-1 lg:ml-60">
      <header className="flex h-20 items-center justify-between border-b border-border bg-white/80 px-5 sm:px-8"><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Workspace</span><ChevronRight className="size-3.5 text-slate-400" aria-hidden="true" /><span className="font-medium">Overview</span></div><LogoutButton /></header>
      <main id="main-content" className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 lg:py-9">
        <div className="flex flex-wrap items-center justify-between gap-5"><div><p className="mb-2 text-xs font-semibold tracking-[0.14em] text-blue-500">YOUR KITCHEN AT A GLANCE</p><h1 className="text-3xl font-semibold tracking-tight">Welcome back, owner.</h1><p className="mt-2 text-sm text-muted-foreground">Let’s make tomorrow a little easier.</p></div><Button asChild><a href="/sales"><Plus aria-hidden="true" />Enter today’s sales</a></Button></div>

        <div className="mt-7 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-secondary-foreground"><Sparkles className="size-4 shrink-0 text-blue-500" aria-hidden="true" /><span>Sales shown for {malaysiaDate()}. Open Tomorrow’s plan to generate or review your serving forecast.</span></div>

        <section aria-label="Kitchen overview" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Today’s sales", icon: BarChart3, value: entered > 0 ? total.toLocaleString("en-MY") : "—", note: entered > 0 ? `Servings sold · ${entered}/5 menus entered${todaySales.provenance ? " · Demo data" : ""}` : "No sales recorded today" },
            { label: "Tomorrow’s servings", value: forecastTotal !== null ? forecastTotal.toFixed(1) : "—", icon: UtensilsCrossed, note: forecast.stale ? "Sales changed · generate again" : forecastTotal !== null ? "Forecast estimate · not approved" : "No forecast generated" },
            { label: "Ingredients to buy", value: "—", icon: ShoppingBasket, note: "No shopping list yet" },
            { label: "Plan approval", value: "—", icon: CheckCheck, note: "No plan to review" },
          ].map(({ label, icon: Icon, note, value }) => <article key={label} className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium text-slate-600">{label}</h2><Icon className="size-[18px] text-blue-400" strokeWidth={1.7} aria-hidden="true" /></div><p className={`mt-5 text-3xl font-medium ${value === "—" ? "text-slate-300" : "text-foreground"}`} aria-label={value === "—" ? "Not available" : undefined}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></article>)}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <section className="overflow-hidden rounded-2xl border border-border bg-white xl:col-span-2" aria-labelledby="plan-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6"><div className="flex items-center gap-2.5"><CalendarDays className="size-[18px] text-blue-500" aria-hidden="true" /><h2 id="plan-heading" className="font-semibold">Tomorrow’s plan</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-muted-foreground">{forecast.latest ? "Forecast saved" : "Not started"}</span></div>
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-9 text-center"><span className="mb-4 grid size-14 place-items-center rounded-2xl border border-blue-100 bg-background text-blue-400"><ClipboardList className="size-7" strokeWidth={1.4} aria-hidden="true" /></span><h3 className="text-sm font-medium">A fresh start for tomorrow</h3><p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">Review tomorrow’s predicted servings. Ingredient planning and approval will be added next.</p><Button variant="outline" size="sm" className="mt-5" asChild><a href="/plan">View forecast<ArrowRight aria-hidden="true" /></a></Button></div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border bg-slate-50/70 px-5 py-3 text-[11px] text-muted-foreground"><span>1. Record sales</span><ChevronRight className="size-3 text-slate-300" aria-hidden="true" /><span>2. Generate plan</span><ChevronRight className="size-3 text-slate-300" aria-hidden="true" /><span>3. Review & approve</span></div>
          </section>
          <section className="rounded-2xl border border-border bg-white" aria-labelledby="stock-heading"><div className="border-b border-border px-6 py-5"><h2 id="stock-heading" className="font-semibold">Stock alerts</h2><p className="mt-1 text-xs text-muted-foreground">Keep an eye on what needs attention.</p></div><EmptyState icon={Package} title="No inventory connected" description="Low stock and upcoming expiry alerts will appear here." /></section>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-white" aria-labelledby="activity-heading"><div className="flex items-center gap-2.5 border-b border-border px-6 py-5"><Clock3 className="size-[18px] text-blue-500" aria-hidden="true" /><h2 id="activity-heading" className="font-semibold">Recent activity</h2></div><div className="flex flex-col items-center gap-3 px-6 py-7 text-center sm:flex-row sm:text-left"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-400"><History className="size-5" strokeWidth={1.5} aria-hidden="true" /></span><div><p className="text-sm font-medium">Nothing here yet</p><p className="mt-1 text-xs text-muted-foreground">Sales entries, stock changes, and approvals will be recorded here.</p></div></div></section>
        <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400"><span>DapurPlan · Made for your everyday kitchen</span><span>Plan thoughtfully. Waste less.</span></footer>
      </main>
    </div>
  </div>;
}
