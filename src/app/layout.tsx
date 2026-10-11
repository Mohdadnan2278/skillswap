import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SkillSwap | Learn together", description: "Exchange skills, find learning partners and grow together through time credits." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
