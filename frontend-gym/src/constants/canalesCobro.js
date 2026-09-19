// Espejo de frontend de src/lib/db/canalesCobro.js. Toda pantalla que
// necesite mostrar/elegir un canal de cobro debe importar esto en vez de
// hardcodear el array de nuevo -- así ampliar un canal es un cambio en un
// solo lugar de cada lado (backend/frontend), no en cada formulario.
export const CANALES_COBRO = [
  { codigo: 'Efectivo', nombre: 'Efectivo', icono: '💵' },
  { codigo: 'QR', nombre: 'QR', icono: '📱' },
  { codigo: 'Transferencia', nombre: 'Transferencia', icono: '🏦' },
  { codigo: 'Tarjeta', nombre: 'Tarjeta', icono: '💳' }
];

export const CODIGOS_CANAL_COBRO = CANALES_COBRO.map(c => c.codigo);

export const CANAL_EFECTIVO = 'Efectivo';

// Heurística SOLO para precargar un valor por defecto razonable durante la
// transición, mientras sigan existiendo las 4 cajas históricas cuya
// descripción ya era el nombre de un canal (ej. "Qr", "PRODUCTOS
// EFECTIVO"). No es una regla del modelo nuevo: una vez que se abran
// jornadas con nombre de punto de cobro real (ej. "Recepción"), esto deja
// de encontrar coincidencia y el admin simplemente elige el canal a mano.
export function inferirCanalPorDescripcionCaja(descripcion) {
  if (!descripcion) return null;
  const texto = descripcion.toLowerCase();
  if (texto.includes('qr')) return 'QR';
  if (texto.includes('transfer')) return 'Transferencia';
  if (texto.includes('tarjeta')) return 'Tarjeta';
  if (texto.includes('efectivo')) return 'Efectivo';
  return null;
}
