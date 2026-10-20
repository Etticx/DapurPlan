import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "DapurPlan",
  description: "Plan tomorrow's meals. Buy what you need.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={GeistSans.variable}><body className="font-sans antialiased">{children}</body></html>;
}
