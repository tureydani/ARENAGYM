// Fuente única de verdad (lado backend) para los canales de cobro
// válidos. Refleja el catálogo `canales_cobro` de la base de datos
// (ver DB__Gimnasio.txt, sección "MODELO CAJA/JORNADA -> CANALES DE
// COBRO"). Se mantiene como constante en código -- en vez de consultar la
// tabla en cada request -- porque son 4 valores fijos y así los endpoints
// pueden validar sin una query extra; la tabla en BD sigue siendo la
// integridad referencial real (FK en pagos/ventas/movimientos_caja).
//
// Agregar un canal nuevo en el futuro: INSERT en `canales_cobro` +
// agregar la entrada acá (y en el espejo de frontend,
// src/constants/canalesCobro.js). No hace falta tocar ningún CHECK.
const CANALES_COBRO = [
  { codigo: 'Efectivo', nombre: 'Efectivo', esFisico: true },
  { codigo: 'QR', nombre: 'QR', esFisico: false },
  { codigo: 'Transferencia', nombre: 'Transferencia', esFisico: false },
  { codigo: 'Tarjeta', nombre: 'Tarjeta', esFisico: false }
];

const CODIGOS_CANAL_COBRO = CANALES_COBRO.map(c => c.codigo);

function esCanalCobroValido(codigo) {
  return CODIGOS_CANAL_COBRO.includes(codigo);
}

// Único canal que representa dinero físico: es el que entra al cálculo de
// "efectivo esperado" en el arqueo. Los demás (QR/Transferencia/Tarjeta)
// mueven saldo registrado pero no efectivo físico.
const CANAL_EFECTIVO = 'Efectivo';

module.exports = { CANALES_COBRO, CODIGOS_CANAL_COBRO, esCanalCobroValido, CANAL_EFECTIVO };
