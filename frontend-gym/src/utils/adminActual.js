// Mismo patrón que ya usan TablaCajas.jsx/TablaPagos.jsx: el admin logueado
// se guarda en sessionStorage al iniciar sesión. Se centraliza acá porque
// el módulo de asistencias lo necesita desde varios componentes (marcado
// rápido, edición, anulación, reactivación).
export function getAdminActual() {
  try {
    const adminData = sessionStorage.getItem('admin');
    return adminData ? JSON.parse(adminData) : null;
  } catch {
    return null;
  }
}

export function getAdminActualId() {
  return getAdminActual()?.id_admin || null;
}
