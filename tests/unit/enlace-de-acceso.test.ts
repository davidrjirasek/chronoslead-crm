import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..", "..");
const acciones = readFileSync(path.join(RAIZ, "src/app/admin/actions.ts"), "utf8");
const panel = readFileSync(path.join(RAIZ, "src/components/admin/padron.tsx"), "utf8");

/**
 * 133 — Los dos fallos del alta de The Student Store, el primer cliente real.
 *
 * Ninguno daba error: el alta decía que todo salió bien y el operador se
 * enteraba al intentar entrar y que lo devolviera al login sin decir nada.
 */
describe("el enlace de acceso sabe para quién es", () => {
  /**
   * 133 pedía que el destino fuera EXPLÍCITO y lo resolvió con dos botones por
   * rol. 136 mantiene la exigencia y la endurece: por PERSONA, no por rol.
   *
   * Con dos administradores, filtrar por rol y hacer `.limit(1)` sin `ORDER BY`
   * devolvía uno indeterminado — y como generar invalida el enlace anterior de
   * esa persona, se le podía romper el acceso a un compañero. Los miembros de
   * Bandeja, además, no podían recibir ninguno.
   */
  it("se pide por miembro concreto, no por rol", () => {
    expect(acciones).toMatch(/formData\.get\("memberId"\)/);
    expect(acciones).toMatch(/eq\(schema\.member\.id, memberId\)/);
  });

  it("ya no elige por rol ni toma «el primero que salga»", () => {
    expect(acciones).not.toMatch(/formData\.get\("para"\)/);
    expect(acciones).not.toMatch(/schema\.member\.role,\s*rol/);
  });

  it("el panel hace elegir a quién, y no deja mandar sin elegir", () => {
    expect(panel).toContain('name="memberId"');
    expect(panel).toContain("Elegí a quién…");
    expect(panel).toContain("required");
  });

  it("el panel no vuelve a ofrecer los dos botones por rol", () => {
    expect(panel).not.toContain('value="dueno"');
    expect(panel).not.toContain('value="soporte"');
  });

  it("el hecho queda en la bitácora que el cliente ve (136)", () => {
    expect(acciones).toMatch(/anotar\(\{/);
    expect(acciones).toMatch(/accion: "enlace"/);
  });
});

describe("la cuenta de soporte puede entrar (133)", () => {
  it("el alta le genera su enlace a cada cuenta de soporte nueva", () => {
    // Se creaban con `password: null` y sin enlace: cuentas sin contraseña y
    // sin forma de ponerle una. 136 — ahora son varias, una por persona.
    expect(acciones).toMatch(/enlacesSoporte/);
    expect(acciones).toMatch(/userId: sop\.userId,\s*\n\s*motivo: "alta"/);
  });

  it("NO le genera uno a quien ya era usuario", () => {
    // El mismo equipo atiende a varios clientes con un solo correo cada uno:
    // generarle un enlace le invalidaría el que pudiera estar usando en otro.
    expect(acciones).toMatch(/if \(!sop\.nuevo\) continue;/);
  });

  it("los dos enlaces se devuelven distinguidos", () => {
    // Si salieran pegados, el operador le manda al cliente el suyo.
    expect(acciones).toContain("SOPORTE");
  });
});

/**
 * 136 — El enlace del DUEÑO, con la misma guarda que la 133 le puso al de
 * soporte.
 *
 * Se generaba siempre. Con un dueño que ya era usuario —Fernando Barreto es
 * propietario de seis organizaciones con un solo correo— cada alta le dejaba
 * vivo un enlace de un solo uso capaz de fijarle la contraseña, y como es el
 * mismo usuario en todas, abría TODAS sus organizaciones.
 */
describe("el alta no reparte llaves de más (136)", () => {
  it("solo le genera enlace al dueño si la cuenta es nueva", () => {
    expect(acciones).toMatch(/const enlace = usuario\[0\]\s*\?\s*null/);
  });

  it("y si ya tenía cuenta, el panel lo dice en vez de dar un enlace", () => {
    expect(acciones).toContain("ya tiene cuenta. Entra en");
    expect(acciones).toContain("No hay enlace que mandar.");
  });
});

/**
 * 136 — El equipo de soporte de la agencia: varios, y también en clientes que
 * ya existen.
 *
 * Con un solo campo había que sumar a los demás desde adentro de cada cliente,
 * y ahí la regla de rangos lo impide: un administrador no nombra
 * administradores. El camino correcto está por encima del propietario.
 */
describe("soporte de la agencia (136)", () => {
  it("el alta acepta varios correos de soporte", () => {
    expect(acciones).toMatch(/partirCorreos\(datos\.data\.correoSoporte/);
    expect(acciones).toMatch(/sumarSoporte\(tx, orgId, correosSoporte\)/);
  });

  it("solo le genera enlace a las cuentas de soporte nuevas", () => {
    expect(acciones).toMatch(/if \(!sop\.nuevo\) continue;/);
  });

  it("existe la acción para sumarlos a un cliente ya creado", () => {
    expect(acciones).toMatch(/export async function sumarSoporteACliente/);
  });

  it("y esa acción no deja degradar al propietario por error", () => {
    expect(acciones).toContain("es el propietario de este cliente");
  });

  it("el panel ofrece el bloque, porque desde el cliente no se puede", () => {
    expect(panel).toContain("Soporte de la agencia");
    expect(panel).toContain('name="correos"');
  });
});

/**
 * 136 — Los dos fallos que aparecieron creando los siete clientes reales.
 *
 * Ninguno lo agarró el gate: no había un solo test que ejercitara la validación
 * del alta ni la forma del resultado. Son el mismo tipo de hueco que la 133.
 */
describe("el alta, probada contra sus dos fallos en producción (136)", () => {
  it("el esquema NO valida el campo de soporte como un solo correo", () => {
    // Tenía `.email()` ahí: pegar los cuatro correos del equipo daba «le falta
    // el @». El campo acepta una lista; validarla es trabajo de
    // primerCorreoInvalido, que además dice CUÁL está mal.
    const campo = acciones.slice(
      acciones.indexOf("correoSoporte: z"),
      acciones.indexOf("correo: z")
    );
    expect(campo).not.toContain(".email(");
  });

  it("devuelve un mensaje por línea, cada uno con su destinatario", () => {
    // Salía todo pegado con UN botón de copiar: mandar el blob entero es
    // repartirle a cada persona las llaves de las demás.
    expect(acciones).toMatch(/const lineas: string\[\]/);
    expect(acciones).toContain("DUEÑO (");
    expect(acciones).toContain("SOPORTE (");
    expect(acciones).toMatch(/lineas\.join\("\\n"\)/);
  });

  it("el panel le pone a cada mensaje su propio botón", () => {
    expect(panel).toContain("function MensajesParaCopiar");
    expect(panel).toContain("function MensajeParaCopiar");
    expect(panel).toMatch(/texto\s*\n?\s*\.split\("\\n"\)/);
  });
});
