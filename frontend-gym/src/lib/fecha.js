// Ayudantes de fecha compartidos por las rutas de API.
//
// El servidor (Vercel) corre en UTC, pero el gimnasio opera en hora
// Bolivia (UTC-4 fijo, sin horario de verano). Usar `new Date()` a secas
// para "hoy" o "el mes actual" es un bug latente: entre ~20:00 y
// medianoche hora Bolivia, el servidor ya "cree" que es el día siguiente
// en UTC, así que una comparación de fecha puede mostrar como vencido
// (o en el mes equivocado) algo que en Bolivia todavía no llegó a ese punto.

// "Hoy" en Bolivia como "YYYY-MM-DD", para comparar contra columnas DATE.
export function fechaHoyBolivia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());
}

// Un Date cuyo año/mes/día civiles (los que devuelven getFullYear(),
// getMonth(), getDate()) son los de HOY en Bolivia, para reemplazar
// `new Date()` en cálculos de "mes actual" o "racha de días" que llaman
// esos getters. No usar este objeto para nada que dependa de la hora del
// día (solo el día calendario es correcto).
export function ahoraBolivia() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return new Date(Number(mapa.year), Number(mapa.month) - 1, Number(mapa.day));
}

// Convierte cualquier fecha/hora (string ISO, Date, timestamp) al día
// calendario "YYYY-MM-DD" que le corresponde EN BOLIVIA, no en la zona
// horaria del runtime que la procesa. Sin esto, una asistencia marcada a
// las 21:00 Bolivia (ya es la 1am del día siguiente en UTC) se agrupaba
// bajo el día equivocado en el calendario y en el cálculo de racha.
export function claveDiaBolivia(fecha) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date(fecha));
}

// Medianoche de un día calendario en Bolivia, expresada como el instante
// UTC real que le corresponde (Bolivia es UTC-4 fijo, sin horario de
// verano: medianoche Bolivia = 04:00 UTC del mismo día). Para usar como
// límite de rango en consultas (Op.gte / Op.lt) sobre columnas timestamp,
// en vez de "medianoche" en la zona horaria del runtime.
export function medianocheBoliviaUTC(anio, mesIndice, dia) {
  return new Date(Date.UTC(anio, mesIndice, dia, 4, 0, 0, 0));
}
