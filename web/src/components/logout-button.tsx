"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="flex flex-col items-end gap-2">
    <Button variant="outline" size="sm" disabled={pending} onClick={async () => {
      setPending(true); setError("");
      try {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (!response.ok) throw new Error("logout failed");
        router.replace("/login"); router.refresh();
      } catch { setError("Could not sign out. Try again."); }
      finally { setPending(false); }
    }}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}Sign out</Button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
