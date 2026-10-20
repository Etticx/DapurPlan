"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(""); setPending(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Could not sign in. Please try again."); return; }
      router.replace("/home"); router.refresh();
    } catch { setError("Could not connect. Please try again."); }
    finally { setPending(false); }
  }

  return <form onSubmit={submit} className="mt-8 space-y-5" aria-label="Sign in" aria-busy={pending}>
    <div className="space-y-2">
      <label htmlFor="username" className="text-sm font-medium">Username</label>
      <Input id="username" name="username" autoComplete="username" placeholder="Enter your username" required value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }} disabled={pending} aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} />
    </div>
    <div className="space-y-2">
      <label htmlFor="password" className="text-sm font-medium">Password</label>
      <div className="relative">
        <Input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} disabled={pending} className="pr-12" aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} />
        <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={pending} className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-md text-slate-400 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
    {error && <div id="login-error" role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</div>}
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Signing in...</> : <>Sign in<ArrowRight aria-hidden="true" /></>}
    </Button>
    <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-3 text-xs text-slate-500"><p className="mb-3">Demo accounts · password: 123</p>{(["owner","staff"] as const).map(account=><div key={account} className="flex items-center justify-between gap-3"><span className="capitalize">{account}</span><button type="button" disabled={pending} onClick={()=>{setUsername(account);setPassword("123");setError("");}} className="rounded py-1 font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary">Use {account} demo</button></div>)}</div>
  </form>;
}
