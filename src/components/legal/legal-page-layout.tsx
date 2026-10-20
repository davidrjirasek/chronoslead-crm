import Image from "next/image";
import type { ReactNode } from "react";
import { LegalFooter } from "./legal-footer";

export function LegalPageLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <Image
        src="/legal/header-legal.png"
        alt="ChronosLead — Powered by Creativo 4D Group"
        width={2172}
        height={430}
        priority
        className="w-full"
      />
      <article className="mx-auto max-w-2xl space-y-10 px-6 py-14">
        <h1 className="font-bold text-3xl text-foreground tracking-tight md:text-4xl">{title}</h1>
        {children}
      </article>
      <LegalFooter />
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground text-xl">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}
