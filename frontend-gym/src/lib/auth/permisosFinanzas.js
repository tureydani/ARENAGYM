// Control de acceso real (no solo ocultar botones) para el módulo
// Finanzas. Es el único lugar del sistema que hoy valida `rol` -- el
// resto de endpoints siguen aceptando cualquier admin autenticado, igual
// que antes de esta migración.
//
// SUPER_ADMIN / ADMIN: acceso completo (crear fondos, registrar
// movimientos, transferir, anular).
// RECEPCIONISTA: solo lectura (consultar fondos/movimientos/resumen).
// ENTRENADOR: sin acceso.
import { verificarAuthAdmin } from './adminAuth';

export const ROLES_ESCRITURA = ['SUPER_ADMIN', 'ADMIN'];
export const ROLES_LECTURA = ['SUPER_ADMIN', 'ADMIN', 'RECEPCIONISTA'];

// Devuelve { auth } si el rol autenticado está en `rolesPermitidos`, o
// { error: { status, body } } listo para retornar si no. auth.rol puede
// venir undefined en tokens emitidos ANTES de esta migración (no llevaban
// rol en el payload) -- se tratan como sin permiso, no como ADMIN por
// defecto, para no abrir el módulo financiero a sesiones viejas sin
// verificar: hay que volver a iniciar sesión una vez para obtener rol.
export async function requerirRolFinanzas(request, rolesPermitidos) {
  const auth = await verificarAuthAdmin(request);
  if (!auth) {
    return { error: { status: 401, body: { error: 'No autorizado' } } };
  }
  if (!auth.rol || !rolesPermitidos.includes(auth.rol)) {
    return {
      error: {
        status: 403,
        body: { error: `Tu rol (${auth.rol || 'sesión sin rol -- vuelve a iniciar sesión'}) no tiene permiso para esta acción de Finanzas.` }
      }
    };
  }
  return { auth };
}

export const requerirLecturaFinanzas = (request) => requerirRolFinanzas(request, ROLES_LECTURA);
export const requerirEscrituraFinanzas = (request) => requerirRolFinanzas(request, ROLES_ESCRITURA);
