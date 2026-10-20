import { redirect } from "next/navigation";
import { Check, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { getOwnerSession } from "@/lib/auth";

export const metadata = { title: "Workspace | DapurPlan" };

export default async function HomePage() {
  const session = await getOwnerSession();
  if (!session) redirect("/login");
  return <main className="min-h-svh bg-background">
    <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-5 py-5 sm:px-10"><Brand /><LogoutButton /></header>
    <section className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <span className="grid size-16 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-primary"><Check className="size-8" aria-hidden="true" /></span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Welcome, owner.</h1>
      <p className="mt-3 text-muted-foreground">You're signed in to DapurPlan.</p>
      <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600"><UserRound className="size-3.5" aria-hidden="true" />Owner workspace</span>
    </section>
  </main>;
}
