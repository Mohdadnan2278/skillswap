import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SkillSwap | Learn together", description: "A student community for exchanging skills through time credits." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
