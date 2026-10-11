"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LogoutButton } from "@/frontend/components/logout-button";
import {useUnreadNotifications} from './notification-inbox';

const destinations = [["/dashboard", "Dashboard"], ["/discover", "Discover"], ["/bookings", "Bookings"], ["/notifications", "Notifications"], ["/wallet", "Wallet"], ["/community", "Community"], ["/profile", "Profile"]] as const;
export function MemberNavigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const unread=useUnreadNotifications();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.removeAttribute("open");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.removeAttribute("open"); menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", escape); };
  }, []);
  const links = [...destinations, ...(isAdmin ? [["/admin", "Admin"] as const] : [])];
  const current = links.find(([href]) => pathname === href || pathname.startsWith(href + "/"))?.[1] ?? "Account";
  function items(close?: (event: React.MouseEvent<HTMLAnchorElement>) => void) {
    return links.map(([href, label]) => {
      const active = pathname === href || pathname.startsWith(href + "/");
      return <Link key={href} href={href} onClick={close} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-selected text-accent-deep" : "text-muted hover:bg-tint hover:text-accent-deep"}`}>{label}{href==='/notifications'&&unread>0&&<span className="rounded-full bg-emerald-800 px-2 py-1 text-xs text-white" aria-label={`${unread} unread notifications`}>{unread>99?'99+':unread}</span>}</Link>;
    });
  }
  return <>
    <nav aria-label="Member navigation" className="hidden flex-wrap items-center gap-1 lg:flex">{items()}<LogoutButton /></nav>
    <details ref={menu} className="group lg:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-line px-2 py-2 text-sm font-semibold text-accent-strong sm:px-3"><span className="hidden sm:inline">{current}</span><span>Menu</span>{unread>0&&<span role="status" aria-label={`${unread} unread notifications`} className="rounded-full bg-emerald-800 px-1.5 py-1 text-xs text-white">{unread>99?'99+':unread}</span>}<span aria-hidden="true" className="group-open:rotate-180">⌄</span></summary>
      <nav aria-label="Mobile member navigation" className="absolute inset-x-0 top-full z-20 grid grid-cols-2 gap-2 rounded-b-2xl border border-line bg-surface p-4 shadow-lg">{items(event => event.currentTarget.closest("details")?.removeAttribute("open"))}<div className="col-span-2 border-t border-line pt-2"><LogoutButton /></div></nav>
    </details>
  </>;
}
