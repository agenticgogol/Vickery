"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Role } from "@/lib/data";
import { subscribeToDataChanges } from "@/lib/live-sync";
import { GuidedAssistant } from "@/components/guided-assistant";
import { logout } from "@/lib/auth-actions";

export type SessionUser = { userId: string; name: string; role: Role };

const navigation: { href: string; label: string; role: Role }[] = [
  { href: "/owner", label: "Billboard Owners", role: "owner" },
  { href: "/advertiser", label: "Advertiser", role: "advertiser" },
  { href: "/admin", label: "Admin", role: "admin" },
];

function rolePath(role: Role) {
  return role === "owner"
    ? "/owner"
    : role === "advertiser"
      ? "/advertiser"
      : "/admin";
}

export function AppShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SessionUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [notification, setNotification] = useState("");
  const role: Role = pathname.startsWith("/owner")
    ? "owner"
    : pathname.startsWith("/advertiser")
      ? "advertiser"
      : "admin";
  const onProtectedRoute = ["/owner", "/advertiser", "/admin"].some((p) => pathname.startsWith(p));
  const isPreviewGated = !session && onProtectedRoute;
  const roleLabel = role === "owner" ? "Billboard Owners" : role === "advertiser" ? "Advertiser" : "Admin";
  useEffect(
    () =>
      subscribeToDataChanges((source) => {
        router.refresh();
        if (source) {
          const labels: Record<string, string> = {
            bid: "New bid received",
            auction: "Auction result updated",
            settlement: "Settlement status updated",
            inventory: "Inventory updated",
            playback: "Proof of play updated",
          };
          setNotification(labels[source] ?? "Marketplace data updated");
          window.setTimeout(() => setNotification(""), 3500);
        }
      }),
    [router],
  );
  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link
            href={rolePath(role)}
            className="flex items-center gap-3"
            aria-label="Billboard Exchange home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">
              BX
            </span>
            <span>
              <span className="block text-[15px] font-bold tracking-tight">
                Billboard Exchange
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Hyderabad network
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navigation
              .filter((item) => !session || item.role === session.role)
              .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${pathname.startsWith(item.href) ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {session ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
              <span className="font-bold text-slate-900">
                {session.name} · {session.role}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1 font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Log in
            </Link>
          )}
        </div>
      </header>
      {notification && (
        <div
          className="fixed right-5 top-20 z-30 rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-lg"
          role="status"
        >
          {notification}
        </div>
      )}
      <main className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        {isPreviewGated ? (
          <>
            <div aria-hidden className="pointer-events-none select-none blur-sm">
              {children}
            </div>
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/20 px-4">
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">Preview mode</p>
                <h2 className="mt-2 text-lg font-bold">
                  Log in to explore the {roleLabel} workspace
                </h2>
                <p className="mt-2 text-sm leading-5 text-slate-500">
                  What you see behind this is real demo data. Log in with a seeded account to bid, release slots, and manage campaigns.
                </p>
                <Link
                  href="/login"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Log in
                </Link>
              </div>
            </div>
          </>
        ) : (
          children
        )}
      </main>
      <GuidedAssistant key={role} role={role} />
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    available: "bg-emerald-50 text-emerald-700",
    auction_open: "bg-amber-50 text-amber-700",
    sold: "bg-cyan-50 text-cyan-700",
    unsold: "bg-slate-100 text-slate-500",
    reserved: "bg-violet-50 text-violet-700",
    unavailable: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${styles[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace("_", " ")}
    </span>
  );
}
export function MetricCard({
  label,
  value,
  detail,
  accent = "cyan",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "cyan" | "orange" | "violet";
}) {
  const colors = {
    cyan: "bg-cyan-500",
    orange: "bg-orange-500",
    violet: "bg-violet-500",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full ${colors[accent]}`} />
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}
