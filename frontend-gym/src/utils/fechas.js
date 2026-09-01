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
