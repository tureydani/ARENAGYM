// La tabla cajas tiene un CHECK (saldo_actual >= 0) como última línea de
// defensa: aunque toda la lógica de la aplicación (validaciones + locks de
// fila) ya debería impedir dejar una caja en negativo, si algún camino
// nuevo se le escapa a esa lógica, es la base de datos la que rechaza el
// cambio en vez de guardar un saldo negativo en silencio. Este helper solo
// traduce ese error técnico de Postgres a un mensaje legible, para no
// mostrarle al usuario un "violates check constraint" crudo.
function mensajeErrorSaldoNegativo(error) {
  const codigoPostgres = error?.original?.code || error?.parent?.code;
  const constraint = error?.original?.constraint || error?.parent?.constraint;
  if (codigoPostgres === '23514' && constraint === 'chk_cajas_saldo_no_negativo') {
    return 'No se pudo completar la operación: dejaría el saldo de una caja en negativo.';
  }
  return null;
}

module.exports = { mensajeErrorSaldoNegativo };
