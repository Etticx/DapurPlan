import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { KitchenIllustration } from "@/components/kitchen-illustration";
import { LoginForm } from "@/components/login-form";
import { getOwnerSession } from "@/lib/auth";

export const metadata = { title: "Sign in | DapurPlan" };

export default async function LoginPage() {
  if (await getOwnerSession()) redirect("/home");
  return <main className="grid min-h-svh bg-white lg:grid-cols-[1fr_1fr]">
    <section aria-label="DapurPlan" className="relative hidden min-h-svh flex-col overflow-hidden bg-[#eaf2ff] p-10 lg:flex xl:p-12">
      <Brand />
      <div className="mx-auto flex w-full max-w-[530px] flex-1 flex-col items-center justify-center pb-8 pt-14">
        <KitchenIllustration />
        <div className="mt-4 text-center">
          <h1 className="text-[36px] font-semibold leading-[1.18] tracking-[-1.3px] xl:text-[42px]">A little planning.<br />A calmer kitchen.</h1>
          <p className="mt-5 text-[15px] text-[#617b9d]">Plan tomorrow. Buy what you need.</p>
        </div>
      </div>
      <p className="text-xs text-[#6c83a3]">Made for your everyday kitchen.</p>
    </section>
    <section aria-label="Owner sign in" className="relative flex min-h-svh flex-col px-6 pb-6 pt-7 sm:px-10 lg:px-12">
      <div className="lg:hidden"><Brand /></div>
      <div className="flex flex-1 items-center justify-center py-12 lg:py-20">
        <div className="w-full max-w-[370px]">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary"><span className="size-1.5 rounded-full bg-primary" />YOUR KITCHEN, CONNECTED</span>
          <h2 className="mt-5 text-[32px] font-semibold leading-tight tracking-[-1px]">Welcome back</h2>
          <p className="mt-2.5 text-[15px] text-muted-foreground">Sign in to your DapurPlan workspace.</p>
          <LoginForm />
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">DapurPlan <span className="px-1.5">/</span> SDC Hackathon 2026</p>
    </section>
  </main>;
}
