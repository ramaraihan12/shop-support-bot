import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin · Kopi Nusantara",
  robots: { index: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-husk bg-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-display text-lg font-bold">
            Kopi Nusantara <span className="font-sans text-sm font-normal text-muted">admin</span>
          </Link>
          <Link href="/" className="text-sm text-bean underline">
            Buka chat
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8">{children}</main>
    </div>
  );
}
