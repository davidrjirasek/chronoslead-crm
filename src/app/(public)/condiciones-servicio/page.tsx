import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/legal-page-layout";

export const metadata: Metadata = { title: "Condiciones del servicio — ChronosLead" };

export default function CondicionesServicioPage() {
  return (
    <LegalPageLayout title="Condiciones del servicio">
      <LegalSection title="Alcance">
        <p>
          Estas condiciones regulan el uso de las soluciones de automatización ofrecidas por
          ChronosLead (Creativo 4D Group) a través de WhatsApp Business API, n8n y plataformas
          conectadas.
        </p>
      </LegalSection>
      <LegalSection title="Uso responsable">
        <p>
          El cliente es responsable de que los datos, cuentas y mensajes que incorpore a sus
          sistemas cuenten con la autorización correspondiente y respeten las políticas de cada
          plataforma.
        </p>
      </LegalSection>
      <LegalSection title="Disponibilidad y terceros">
        <p>
          Las integraciones dependen también de servicios de terceros. ChronosLead mantendrá y
          mejorará la infraestructura acordada, sin garantizar disponibilidad absoluta de
          plataformas externas.
        </p>
      </LegalSection>
      <LegalSection title="Modificaciones">
        <p>
          Estas condiciones pueden actualizarse. Los cambios relevantes se comunicarán por correo o
          mediante este sitio.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
