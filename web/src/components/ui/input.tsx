import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(
    "flex h-12 w-full rounded-lg border border-input bg-white px-3.5 py-2 text-base text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/10 md:text-sm",
    className,
  )} {...props} />;
}
