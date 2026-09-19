// Espejo de frontend de src/lib/db/finanzasCatalogos.js.
export const TIPOS_FONDO = [
  { codigo: 'CAJA_FISICA', nombre: 'Caja física', icono: '💵' },
  { codigo: 'BANCO', nombre: 'Banco', icono: '🏦' },
  { codigo: 'CUENTA_QR', nombre: 'Cuenta QR', icono: '📱' },
  { codigo: 'TARJETA_POR_COBRAR', nombre: 'Tarjeta por cobrar', icono: '💳' },
  { codigo: 'OTRO', nombre: 'Otro', icono: '📦' }
];

export const CATEGORIAS_INGRESO = [
  { codigo: 'SALDO_INICIAL', nombre: 'Saldo inicial' },
  { codigo: 'APORTE', nombre: 'Aporte' },
  { codigo: 'COBRO', nombre: 'Cobro' },
  { codigo: 'RECUPERACION', nombre: 'Recuperación' },
  { codigo: 'CIERRE_JORNADA', nombre: 'Efectivo de cierre de jornada' },
  { codigo: 'OTRO_INGRESO', nombre: 'Otro ingreso' }
];

export const CATEGORIAS_EGRESO = [
  { codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  { codigo: 'COMPRA', nombre: 'Compra' },
  { codigo: 'SERVICIOS', nombre: 'Servicios' },
  { codigo: 'MANTENIMIENTO', nombre: 'Mantenimiento' },
  { codigo: 'RETIRO_PROPIETARIO', nombre: 'Retiro propietario' },
  { codigo: 'GASTO_OPERATIVO', nombre: 'Gasto operativo' },
  { codigo: 'OTRO_EGRESO', nombre: 'Otro egreso' }
];

export const ROLES_ESCRITURA_FINANZAS = ['SUPER_ADMIN', 'ADMIN'];
export const ROLES_LECTURA_FINANZAS = ['SUPER_ADMIN', 'ADMIN', 'RECEPCIONISTA'];

export function tieneAccesoFinanzas(rol, { escritura = false } = {}) {
  const permitidos = escritura ? ROLES_ESCRITURA_FINANZAS : ROLES_LECTURA_FINANZAS;
  return permitidos.includes(rol);
}
