import type { Metadata } from "next";
import "./globals.css";
import { ThemeObserver } from "@/frontend/components/theme-control";
import { themeBootScript } from "@/shared/theme";
export const metadata: Metadata = { title: "SkillSwap | Learn together", description: "Exchange skills, find learning partners and grow together through time credits." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootScript }}/></head><body><ThemeObserver/>{children}</body></html>;
}
