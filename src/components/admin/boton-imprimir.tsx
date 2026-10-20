"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 109 — Abre el diálogo de impresión, que es de donde sale el PDF. */
export function BotonImprimir() {
  return (
    <Button type="button" onClick={() => window.print()} className="shrink-0">
      <Printer className="mr-1.5 h-4 w-4" strokeWidth={2} />
      Imprimir o guardar PDF
    </Button>
  );
}
