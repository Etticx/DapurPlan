import { CookingPot } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return <div className={cn("flex items-center gap-2.5", className)}>
    <span className="grid size-10 place-items-center rounded-xl bg-primary text-white"><CookingPot className="size-6" strokeWidth={1.8} aria-hidden="true" /></span>
    <span className="text-[21px] font-semibold tracking-[-0.7px] text-foreground">Dapur<span className="text-primary">Plan</span></span>
  </div>;
}
