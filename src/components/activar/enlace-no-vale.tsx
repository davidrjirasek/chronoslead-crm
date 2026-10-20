import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 106 — Lo mismo para un enlace inventado, caducado o ya usado.
 *
 * No se distinguen a propósito: decirle a alguien «este caducó» le confirma
 * que existía. Y para el cliente legítimo la salida es la misma en los tres
 * casos — pedir otro —, así que separarlos no le ahorraría un solo paso.
 */
export function EnlaceNoVale() {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Este enlace ya no sirve</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-text-3">
        <p>
          Los enlaces de acceso duran 7 días y solo se pueden usar una vez. Si ya
          lo usaste, entra con tu correo y tu contraseña desde la pantalla de
          inicio.
        </p>
        <p>
          Si no llegaste a usarlo, pídele uno nuevo a quien te dio de alta en
          ChronosLead. Tarda un momento y tus datos siguen donde estaban.
        </p>
      </CardContent>
    </Card>
  );
}
