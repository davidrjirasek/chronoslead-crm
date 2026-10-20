import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/legal-page-layout";

export const metadata: Metadata = { title: "Política de privacidad — ChronosLead" };

export default function PrivacidadPage() {
  return (
    <LegalPageLayout title="Política de privacidad">
      <LegalSection title="Nuestro compromiso">
        <p>
          En ChronosLead, un producto de Creativo 4D Group, valoramos la privacidad de usuarios,
          clientes y visitantes. Esta política describe cómo recopilamos, usamos, almacenamos y
          protegemos información personal relacionada con nuestros servicios de automatización,
          mensajería y asistencia técnica vía WhatsApp Business API.
        </p>
      </LegalSection>
      <LegalSection title="Información que podemos tratar">
        <p>Datos de contacto: nombre, correo, teléfono y empresa.</p>
        <p>
          Información de negocio: identificadores de Meta Business Manager, páginas de Facebook y
          números de WhatsApp.
        </p>
        <p>
          Datos técnicos: tokens de acceso, IDs de aplicaciones, configuraciones de webhook y
          registros de automatización.
        </p>
        <p>Información de uso: métricas de interacción, entregas y errores técnicos.</p>
      </LegalSection>
      <LegalSection title="Cómo usamos la información">
        <p>Configurar y operar flujos de automatización en nombre del negocio cliente.</p>
        <p>Brindar soporte técnico, mantenimiento y mejora continua.</p>
        <p>Atender solicitudes, prevenir uso no autorizado y cumplir obligaciones aplicables.</p>
        <p>
          Cada cliente conserva la titularidad de su propia cuenta de WhatsApp Business y de los
          datos que gestiona a través de ella; ChronosLead actúa como proveedor tecnológico, no como
          propietario de esos datos.
        </p>
      </LegalSection>
      <LegalSection title="Tus derechos">
        <p>
          Puedes solicitar acceso, rectificación, cancelación, oposición o eliminación de tus datos,
          así como revocar tu consentimiento. Escríbenos a{" "}
          <a href="mailto:soporte@chronoslead.com" className="underline">
            soporte@chronoslead.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
