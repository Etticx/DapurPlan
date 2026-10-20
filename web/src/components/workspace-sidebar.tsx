import {getSession} from "@/lib/auth";
import { BarChart3, BookOpen, CalendarDays, History, LayoutDashboard, Leaf, Package, ShieldCheck, UsersRound } from "lucide-react";
import { Brand } from "@/components/brand";
const navigation = [
  { label: "Daily sales", icon: BarChart3 },
  { label: "Inventory", icon: Package },
  { label: "Recipes", icon: BookOpen },
  { label: "Tomorrow’s plan", icon: CalendarDays },
  { label: "Activity log", icon: History },
];
export async function WorkspaceSidebar({active}: {active: "Overview" | "Recipes" | "Inventory" | "Daily sales" | "Tomorrow’s plan" | "Team & access" | "Activity log"}) {
 const user=await getSession();const owner=user?.role==="owner";
 return (<aside className="flex flex-col border-b border-border bg-white lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:border-b-0">
      <div className="px-6 py-7"><Brand /><p className="mt-3 pl-0.5 text-xs text-muted-foreground">Your everyday kitchen companion</p></div>
      <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:px-4">
        <a href="/home" aria-current={active === "Overview" ? "page" : undefined} className={`flex shrink-0 items-center gap-3 rounded-xl ${active === "Overview" ? "bg-secondary text-primary" : "text-slate-600 hover:bg-secondary"} px-4 py-3 text-sm font-semibold`}><LayoutDashboard className="size-[18px]" aria-hidden="true" />Overview{active === "Overview" && <span className="ml-auto hidden size-1.5 rounded-full bg-primary lg:block" />}</a>
        {navigation.map(({ label, icon: Icon }) => (label === "Recipes" || label === "Inventory" || label === "Daily sales" || label === "Tomorrow’s plan" || label === "Activity log") ? <a key={label} href={label === "Recipes" ? "/recipes" : label === "Inventory" ? "/inventory" : label === "Daily sales" ? "/sales" : label === "Tomorrow’s plan" ? "/plan" : "/activity"} aria-current={active === label ? "page" : undefined} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${active === label ? "bg-secondary text-primary" : "text-slate-600 hover:bg-secondary"}`}><Icon className="size-[18px]" aria-hidden="true" />{label}</a> : <button key={label} type="button" disabled title="Coming in a later step" className="flex shrink-0 cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-slate-400"><Icon className="size-[18px]" aria-hidden="true" />{label}</button>)}
        {owner&&<div className="shrink-0 lg:hidden"><a href="/team" aria-current={active==="Team & access"?"page":undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${active==="Team & access"?"bg-secondary text-primary":"text-slate-600 hover:bg-secondary"}`}><UsersRound className="size-[18px]" aria-hidden="true"/>Team & access</a></div>}
      </nav>
      <div className="mt-auto hidden px-5 pb-6 lg:block">
        <div className="rounded-2xl border border-blue-100 bg-background p-4"><Leaf className="mb-3 size-5 text-blue-500" strokeWidth={1.6} aria-hidden="true" /><p className="text-xs font-semibold">A little less waste.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A little more peace of mind.</p></div>
        {owner&&<div className="mt-4"><a href="/team" aria-current={active==="Team & access"?"page":undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${active==="Team & access"?"bg-secondary text-primary":"text-slate-600 hover:bg-secondary"}`}><UsersRound className="size-[18px]" aria-hidden="true"/>Team & access</a></div>}
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-5"><span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary">{owner?"O":"S"}</span><div><p className="text-sm font-medium">{owner?"Owner":"Staff"}</p><p className="mt-0.5 text-xs text-muted-foreground">{owner?"Owner workspace":"Staff workspace"}</p></div><ShieldCheck className="ml-auto size-4 text-slate-400" aria-label={owner?"Owner access":"Staff access"} /></div>
      </div>
    </aside>);
}
