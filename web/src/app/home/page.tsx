import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, BookOpen, CalendarDays, CheckCheck, ChevronRight, ClipboardList, Clock3, History, LayoutDashboard, Leaf, Package, Plus, ShieldCheck, ShoppingBasket, Sparkles, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { getOwnerSession } from "@/lib/auth";

export const metadata = { title: "Overview | DapurPlan" };

const navigation = [
  { label: "Daily sales", icon: BarChart3 },
  { label: "Inventory", icon: Package },
  { label: "Recipes", icon: BookOpen },
  { label: "Tomorrow’s plan", icon: CalendarDays },
  { label: "Activity log", icon: History },
];

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

  return <div className="min-h-svh lg:flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-4">Skip to content</a>
    <aside className="flex flex-col border-b border-border bg-white lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:border-b-0">
      <div className="px-6 py-7"><Brand /><p className="mt-3 pl-0.5 text-xs text-muted-foreground">Your everyday kitchen companion</p></div>
      <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:px-4">
        <a href="/home" aria-current="page" className="flex shrink-0 items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-primary"><LayoutDashboard className="size-[18px]" aria-hidden="true" />Overview<span className="ml-auto hidden size-1.5 rounded-full bg-primary lg:block" /></a>
        {navigation.map(({ label, icon: Icon }) => <button key={label} type="button" disabled title="Coming in a later step" className="flex shrink-0 cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-slate-400"><Icon className="size-[18px]" aria-hidden="true" />{label}</button>)}
      </nav>
      <div className="mt-auto hidden px-5 pb-6 lg:block">
        <div className="rounded-2xl border border-blue-100 bg-background p-4"><Leaf className="mb-3 size-5 text-blue-500" strokeWidth={1.6} aria-hidden="true" /><p className="text-xs font-semibold">A little less waste.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A little more peace of mind.</p></div>
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-5"><span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary">O</span><div><p className="text-sm font-medium">Owner</p><p className="mt-0.5 text-xs text-muted-foreground">Owner workspace</p></div><ShieldCheck className="ml-auto size-4 text-slate-400" aria-label="Owner access" /></div>
      </div>
    </aside>

    <div className="min-w-0 flex-1 lg:ml-60">
      <header className="flex h-20 items-center justify-between border-b border-border bg-white/80 px-5 sm:px-8"><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Workspace</span><ChevronRight className="size-3.5 text-slate-400" aria-hidden="true" /><span className="font-medium">Overview</span></div><LogoutButton /></header>
      <main id="main-content" className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 lg:py-9">
        <div className="flex flex-wrap items-center justify-between gap-5"><div><p className="mb-2 text-xs font-semibold tracking-[0.14em] text-blue-500">YOUR KITCHEN AT A GLANCE</p><h1 className="text-3xl font-semibold tracking-tight">Welcome back, owner.</h1><p className="mt-2 text-sm text-muted-foreground">Let’s make tomorrow a little easier.</p></div><Button disabled title="Sales entry is coming next"><Plus aria-hidden="true" />Enter today’s sales</Button></div>

        <div className="mt-7 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-secondary-foreground"><Sparkles className="size-4 shrink-0 text-blue-500" aria-hidden="true" /><span>Dashboard preview. Your kitchen records will appear here once connected.</span></div>

        <section aria-label="Kitchen overview" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Today’s sales", icon: BarChart3, note: "No sales recorded" },
            { label: "Tomorrow’s servings", icon: UtensilsCrossed, note: "No plan generated" },
            { label: "Ingredients to buy", icon: ShoppingBasket, note: "No shopping list yet" },
            { label: "Plan approval", icon: CheckCheck, note: "No plan to review" },
          ].map(({ label, icon: Icon, note }) => <article key={label} className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium text-slate-600">{label}</h2><Icon className="size-[18px] text-blue-400" strokeWidth={1.7} aria-hidden="true" /></div><p className="mt-5 text-3xl font-medium text-slate-300" aria-label="Not available">—</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></article>)}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <section className="overflow-hidden rounded-2xl border border-border bg-white xl:col-span-2" aria-labelledby="plan-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6"><div className="flex items-center gap-2.5"><CalendarDays className="size-[18px] text-blue-500" aria-hidden="true" /><h2 id="plan-heading" className="font-semibold">Tomorrow’s plan</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-muted-foreground">Not started</span></div>
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-9 text-center"><span className="mb-4 grid size-14 place-items-center rounded-2xl border border-blue-100 bg-background text-blue-400"><ClipboardList className="size-7" strokeWidth={1.4} aria-hidden="true" /></span><h3 className="text-sm font-medium">A fresh start for tomorrow</h3><p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">Your serving forecast and ingredient needs will appear here when a plan is ready.</p><Button variant="outline" size="sm" className="mt-5" disabled title="Planning will be connected in a later step">View plan<ArrowRight aria-hidden="true" /></Button></div>
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
