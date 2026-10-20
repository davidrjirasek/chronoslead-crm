import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/legal-page-layout";

export const metadata: Metadata = { title: "Eliminación de datos — ChronosLead" };

export default function EliminacionDatosPage() {
  return (
    <LegalPageLayout title="Eliminación de datos">
      <LegalSection title="Tu derecho">
        <p>
          ChronosLead respeta el derecho de usuarios y clientes a solicitar la eliminación de sus
          datos personales y técnicos.
        </p>
      </LegalSection>
      <LegalSection title="Cómo solicitarla">
        <p>
          Envía tu solicitud a{" "}
          <a href="mailto:soporte@chronoslead.com" className="underline">
            soporte@chronoslead.com
          </a>{" "}
          e indica:
        </p>
        <p>Nombre del negocio o cliente.</p>
        <p>Activo vinculado, como número de WhatsApp o página.</p>
        <p>Tipo de datos que deseas eliminar.</p>
        <p>La solicitud se atenderá en un máximo de 10 días hábiles.</p>
      </LegalSection>
      <LegalSection title="Instancias administradas">
        <p>
          Si deseas eliminar datos operativos de una instancia, contacta también a tu proveedor o
          administrador. Incluye el identificador de tu solicitud para que podamos localizarla.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
