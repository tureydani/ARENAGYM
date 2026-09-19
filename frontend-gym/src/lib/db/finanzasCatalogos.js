// Espejo backend de los catálogos tipos_fondo / categorias_financieras
// (ver migrate-finanzas.js). Igual que canalesCobro.js: validar sin query
// extra; la tabla en BD sigue siendo la integridad referencial real.
const TIPOS_FONDO = ['CAJA_FISICA', 'BANCO', 'CUENTA_QR', 'TARJETA_POR_COBRAR', 'OTRO'];

const CATEGORIAS_FINANCIERAS = {
  INGRESO: ['SALDO_INICIAL', 'APORTE', 'COBRO', 'RECUPERACION', 'OTRO_INGRESO', 'TRANSFERENCIA', 'ANULACION', 'CIERRE_JORNADA'],
  EGRESO: ['PROVEEDOR', 'COMPRA', 'SERVICIOS', 'MANTENIMIENTO', 'RETIRO_PROPIETARIO', 'GASTO_OPERATIVO', 'OTRO_EGRESO', 'TRANSFERENCIA', 'ANULACION']
};

const ORIGENES_VALIDOS = ['SALDO_INICIAL', 'MANUAL', 'TRANSFERENCIA', 'CIERRE_JORNADA', 'ANULACION'];

function esTipoFondoValido(codigo) {
  return TIPOS_FONDO.includes(codigo);
}

function esCategoriaValidaParaTipo(categoria, tipo) {
  if (tipo !== 'INGRESO' && tipo !== 'EGRESO') return false;
  return CATEGORIAS_FINANCIERAS[tipo].includes(categoria);
}

module.exports = { TIPOS_FONDO, CATEGORIAS_FINANCIERAS, ORIGENES_VALIDOS, esTipoFondoValido, esCategoriaValidaParaTipo };
