// Ayudantes para mostrar/comparar columnas DATE (sin hora) del backend:
// fecha_registro, fecha_nacimiento, fecha_contratacion, fecha_inicio,
// fecha_fin, fecha_pago, fecha_venta, fecha_apertura, fecha_movimiento...
//
// El bug clásico: `new Date("2026-08-31")` lo interpreta JavaScript como
// medianoche UTC, y `.toLocaleDateString()` lo vuelve a convertir a la
// zona horaria del navegador. En Bolivia (UTC-4) eso resta 4 horas, así
// que una fecha "31/08" se termina mostrando como "30/08" -- un día
// antes de lo que realmente se guardó. Estas funciones parsean el
// string a mano (año-mes-día) y arman la fecha con el constructor local
// de Date, que no aplica ningún corrimiento de zona horaria para un
// mismo día calendario.

function partesDeFecha(fecha) {
  if (!fecha) return null;
  const fechaStr = fecha.toString();
  const soloFecha = fechaStr.includes('T') ? fechaStr.split('T')[0] : fechaStr;
  const partes = soloFecha.split('-');
  if (partes.length !== 3) return null;
  const [anio, mes, dia] = partes.map(Number);
  if (!anio || !mes || !dia) return null;
  return { anio, mes, dia };
}

// Devuelve un Date "local" (sin corrimiento) a partir de una columna DATE.
// Útil para comparar/ordenar/filtrar por rango de fechas.
export function parsearFechaLocal(fecha) {
  const partes = partesDeFecha(fecha);
  if (!partes) return fecha ? new Date(fecha) : null;
  return new Date(partes.anio, partes.mes - 1, partes.dia);
}

// Formatea una columna DATE para mostrarla, sin el corrimiento de un día.
export function formatearFecha(fecha, opciones = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!fecha) return 'N/A';
  const local = parsearFechaLocal(fecha);
  if (!local) return 'N/A';
  return local.toLocaleDateString('es-ES', opciones);
}

// --- Ayudantes para columnas TIMESTAMP (fecha_hora), como
// asistencias.fecha_hora: a diferencia de las columnas DATE de arriba,
// estas sí tienen una hora real y hay que mostrarlas en hora de Bolivia
// (no en la zona horaria del navegador de quien esté mirando el panel).

export function formatearFechaHoraBolivia(fechaHora) {
  if (!fechaHora) return 'N/A';
  const fecha = new Date(fechaHora);
  if (Number.isNaN(fecha.getTime())) return 'N/A';
  return fecha.toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatearSoloFechaBolivia(fechaHora) {
  if (!fechaHora) return 'N/A';
  const fecha = new Date(fechaHora);
  if (Number.isNaN(fecha.getTime())) return 'N/A';
  return fecha.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatearSoloHoraBolivia(fechaHora) {
  if (!fechaHora) return 'N/A';
  const fecha = new Date(fechaHora);
  if (Number.isNaN(fecha.getTime())) return 'N/A';
  return fecha.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' });
}

// "Hoy" en Bolivia como YYYY-MM-DD, para valores por defecto de filtros de
// fecha en el frontend (mismo criterio que fechaHoyBolivia() en backend).
export function hoyBoliviaISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());
}
