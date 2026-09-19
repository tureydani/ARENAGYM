const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const MovimientoFinanciero = sequelize.define('MovimientoFinanciero', {
  id_movimiento: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_fondo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'fondos', key: 'id_fondo' }
  },
  tipo: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: { isIn: [['INGRESO', 'EGRESO']] }
  },
  categoria: {
    type: DataTypes.STRING(40),
    allowNull: false,
    references: { model: 'categorias_financieras', key: 'codigo' }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  fecha_movimiento: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  id_admin: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // SALDO_INICIAL (alta de fondo) | MANUAL | TRANSFERENCIA (par de filas)
  // | CIERRE_JORNADA (efectivo contado trasladado) | ANULACION (fila de
  // reversión generada al anular otro movimiento).
  origen: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: { isIn: [['SALDO_INICIAL', 'MANUAL', 'TRANSFERENCIA', 'CIERRE_JORNADA', 'ANULACION']] }
  },
  id_referencia: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_jornada: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'cajas', key: 'id_caja' }
  },
  id_transferencia: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  motivo_anulacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fecha_anulacion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  id_admin_anulacion: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'movimientos_financieros',
  timestamps: false
});

module.exports = MovimientoFinanciero;
