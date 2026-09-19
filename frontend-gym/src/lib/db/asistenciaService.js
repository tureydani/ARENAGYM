const { Op } = require('sequelize');
const sequelize = require('./sequelize');
const { Asistencia, Usuario, RegistroMembresia, Membresia, Administrativo, AuditoriaAsistencia } = require('./models');
const { fechaHoyBolivia, claveDiaBolivia, medianocheBoliviaUTC } = require('../fecha');

// Única fuente de verdad para registrar/editar/anular/reactivar una
// asistencia: tanto el escaneo QR como el marcado manual (y las rutas de
// edición/anulación) pasan por estas mismas funciones, para no duplicar
// las reglas de negocio (membresía vigente, límite de accesos, duplicados,
// auditoría) en dos lugares que puedan desincronizarse.

function formatearFechaLegible(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

function formatearHoraLegible(fecha) {
  return new Date(fecha).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/La_Paz' });
}

const INCLUDE_DETALLE = [
  { model: Usuario.scope('withInactive'), as: 'Usuario', attributes: ['id_usuario', 'nombre', 'apellido', 'telefono'] },
  {
    model: RegistroMembresia.scope('withInactive'),
    as: 'RegistroMembresia',
    include: [{ model: Membresia.scope('withInactive'), as: 'Membresia', attributes: ['id_membresia', 'tipo', 'limite_asistencias'] }]
  },
  { model: Administrativo.scope('withInactive'), as: 'Administrativo', attributes: ['id_admin', 'nombre', 'apellido'] }
];

// Busca la membresía vigente "hoy" para un cliente (mismo criterio que ya
// usaba el resto del panel: registro activo y fecha_fin todavía no pasó, o
// sin fecha_fin). Con `lock` bloquea la fila dentro de una transacción para
// serializar dos registros casi simultáneos del mismo cliente (dos scans
// del mismo QR, o un scan + un marcado manual a la vez).
async function obtenerMembresiaVigente(id_usuario, { transaction, lock } = {}) {
  const hoy = fechaHoyBolivia();
  return RegistroMembresia.findOne({
    where: {
      id_usuario,
      activo: true,
      [Op.or]: [{ fecha_fin: null }, { fecha_fin: { [Op.gte]: hoy } }]
    },
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined
  });
}

// Cuántas asistencias activas ya consumió una membresía específica
// (nunca cuenta las anuladas: ver regla fundamental de la sección 39).
async function contarUsoMembresia(id_registro, { transaction } = {}) {
  if (!id_registro) return 0;
  return Asistencia.count({ where: { id_registro, activo: true }, transaction });
}

// Registra una asistencia (QR o manual) aplicando siempre las mismas
// validaciones. Devuelve un resultado con `tipo` para que la ruta decida
// el status HTTP y el mensaje exacto, en vez de lanzar excepciones para
// casos de negocio esperados (cliente inactivo, membresía vencida, etc.).
async function registrarAsistencia({ id_usuario, metodo, id_admin, observacion }) {
  const transaction = await sequelize.transaction();
  try {
    const usuario = await Usuario.findOne({ where: { id_usuario, activo: true }, transaction });
    if (!usuario) {
      await transaction.rollback();
      return { tipo: 'no_encontrado', error: 'Cliente no encontrado o inactivo' };
    }

    // Bloquea la membresía vigente del cliente para que dos registros
    // simultáneos (mismo cliente) no puedan pasar ambos el chequeo de
    // duplicado/límite antes de que el otro haya confirmado su insert.
    const membresiaVigente = await obtenerMembresiaVigente(id_usuario, { transaction, lock: true });

    if (!membresiaVigente) {
      const ultimaMembresia = await RegistroMembresia.scope('withInactive').findOne({
        where: { id_usuario },
        order: [['fecha_fin', 'DESC']],
        transaction
      });

      const mensaje = ultimaMembresia?.fecha_fin
        ? `Membresía vencida el ${formatearFechaLegible(ultimaMembresia.fecha_fin)}. No se puede registrar el ingreso.`
        : 'Este cliente no tiene una membresía activa registrada. No se puede registrar el ingreso.';

      await transaction.rollback();
      return {
        tipo: 'membresia_vencida',
        error: mensaje,
        usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellido: usuario.apellido }
      };
    }

    // Duplicado: el cliente ya tiene una asistencia válida hoy (día
    // calendario Bolivia). Se aplica siempre, no solo a membresías con
    // límite, para evitar doble marcación accidental en general.
    const hoy = fechaHoyBolivia();
    const ultimaAsistencia = await Asistencia.findOne({
      where: { id_usuario, activo: true },
      order: [['fecha_hora', 'DESC']],
      transaction
    });

    if (ultimaAsistencia && claveDiaBolivia(ultimaAsistencia.fecha_hora) === hoy) {
      await transaction.rollback();
      return {
        tipo: 'duplicado',
        message: `${usuario.nombre} ${usuario.apellido} ya registró su ingreso hoy a las ${formatearHoraLegible(ultimaAsistencia.fecha_hora)}.`,
        usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellido: usuario.apellido },
        fecha_hora: ultimaAsistencia.fecha_hora
      };
    }

    // Membresías con límite de asistencias (ej. "15 accesos"): se cuenta
    // contra las asistencias ACTIVAS vinculadas a ESTE registro (no todo
    // el historial del usuario), para que renovar reinicie el contador.
    if (membresiaVigente.limite_asistencias !== null) {
      const usadas = await contarUsoMembresia(membresiaVigente.id_registro, { transaction });
      if (usadas >= membresiaVigente.limite_asistencias) {
        await transaction.rollback();
        return {
          tipo: 'limite',
          error: `${usuario.nombre} ${usuario.apellido} ya utilizó las ${membresiaVigente.limite_asistencias} asistencias incluidas en su membresía actual.`,
          usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellido: usuario.apellido }
        };
      }
    }

    const asistencia = await Asistencia.create({
      id_usuario,
      id_registro: membresiaVigente.id_registro,
      metodo,
      id_admin: id_admin || null,
      observacion: observacion || null
    }, { transaction });

    await AuditoriaAsistencia.create({
      id_asistencia: asistencia.id_asistencia,
      id_admin: id_admin || null,
      accion: 'CREACION',
      datos_nuevos: asistencia.toJSON()
    }, { transaction });

    await transaction.commit();

    let message = `Asistencia registrada: ${usuario.nombre} ${usuario.apellido}`;
    const respuesta = {
      tipo: 'ok',
      usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellido: usuario.apellido },
      fecha_hora: asistencia.fecha_hora,
      id_asistencia: asistencia.id_asistencia,
      metodo: asistencia.metodo
    };

    if (membresiaVigente.limite_asistencias !== null) {
      const asistenciasUsadas = await contarUsoMembresia(membresiaVigente.id_registro);
      respuesta.asistenciasUsadas = asistenciasUsadas;
      respuesta.limiteAsistencias = membresiaVigente.limite_asistencias;
      message += ` (${asistenciasUsadas}/${membresiaVigente.limite_asistencias} accesos usados)`;
    }

    respuesta.message = message;
    return respuesta;
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

async function obtenerDetalle(id_asistencia) {
  const asistencia = await Asistencia.scope('withInactive').findByPk(id_asistencia, { include: INCLUDE_DETALLE });
  if (!asistencia) return null;

  const auditorias = await AuditoriaAsistencia.findAll({
    where: { id_asistencia },
    include: [{ model: Administrativo.scope('withInactive'), as: 'Administrativo', attributes: ['id_admin', 'nombre', 'apellido'] }],
    order: [['fecha_accion', 'ASC']]
  });

  const asistenciasUsadas = asistencia.id_registro
    ? await contarUsoMembresia(asistencia.id_registro)
    : 0;

  return { asistencia, auditorias, asistenciasUsadas };
}

// Solo se pueden editar: fecha_hora, id_usuario (recalculando id_registro
// contra la membresía vigente HOY, misma simplificación que usa el resto
// del panel para "membresía vigente") y observación. El motivo y el admin
// responsable son obligatorios y quedan en la auditoría.
async function editarAsistencia(id_asistencia, { fecha_hora, id_usuario, observacion, motivo, id_admin }) {
  if (!motivo || !motivo.trim()) {
    return { tipo: 'error', error: 'El motivo de la modificación es obligatorio' };
  }
  if (!id_admin) {
    return { tipo: 'error', error: 'Falta el administrativo responsable de la edición' };
  }

  const transaction = await sequelize.transaction();
  try {
    const asistencia = await Asistencia.scope('withInactive').findByPk(id_asistencia, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asistencia) {
      await transaction.rollback();
      return { tipo: 'no_encontrado', error: 'Asistencia no encontrada' };
    }

    const datosAnteriores = asistencia.toJSON();
    const cambios = { fecha_actualizacion: new Date() };

    if (fecha_hora) {
      const fecha = new Date(fecha_hora);
      if (Number.isNaN(fecha.getTime())) {
        await transaction.rollback();
        return { tipo: 'error', error: 'Fecha/hora inválida' };
      }
      cambios.fecha_hora = fecha;
    }

    if (observacion !== undefined) {
      cambios.observacion = observacion || null;
    }

    if (id_usuario && Number(id_usuario) !== asistencia.id_usuario) {
      const nuevoUsuario = await Usuario.findOne({ where: { id_usuario, activo: true }, transaction });
      if (!nuevoUsuario) {
        await transaction.rollback();
        return { tipo: 'error', error: 'El nuevo cliente no existe o está inactivo' };
      }
      const membresiaVigente = await obtenerMembresiaVigente(id_usuario, { transaction });
      if (!membresiaVigente) {
        await transaction.rollback();
        return { tipo: 'error', error: `${nuevoUsuario.nombre} ${nuevoUsuario.apellido} no tiene una membresía vigente. No se puede reasignar la asistencia a este cliente.` };
      }
      cambios.id_usuario = Number(id_usuario);
      cambios.id_registro = membresiaVigente.id_registro;
    }

    await asistencia.update(cambios, { transaction });

    await AuditoriaAsistencia.create({
      id_asistencia: asistencia.id_asistencia,
      id_admin,
      accion: 'EDICION',
      motivo: motivo.trim(),
      datos_anteriores: datosAnteriores,
      datos_nuevos: asistencia.toJSON()
    }, { transaction });

    await transaction.commit();
    return { tipo: 'ok', asistencia };
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

async function anularAsistencia(id_asistencia, { motivo, id_admin }) {
  if (!motivo || !motivo.trim()) {
    return { tipo: 'error', error: 'El motivo de la anulación es obligatorio' };
  }
  if (!id_admin) {
    return { tipo: 'error', error: 'Falta el administrativo responsable de la anulación' };
  }

  const transaction = await sequelize.transaction();
  try {
    const asistencia = await Asistencia.scope('withInactive').findByPk(id_asistencia, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asistencia) {
      await transaction.rollback();
      return { tipo: 'no_encontrado', error: 'Asistencia no encontrada' };
    }
    if (!asistencia.activo) {
      await transaction.rollback();
      return { tipo: 'error', error: 'Esta asistencia ya está anulada' };
    }

    const datosAnteriores = asistencia.toJSON();
    await asistencia.update({ activo: false, fecha_actualizacion: new Date() }, { transaction });

    await AuditoriaAsistencia.create({
      id_asistencia: asistencia.id_asistencia,
      id_admin,
      accion: 'ANULACION',
      motivo: motivo.trim(),
      datos_anteriores: datosAnteriores,
      datos_nuevos: asistencia.toJSON()
    }, { transaction });

    await transaction.commit();
    return { tipo: 'ok', asistencia };
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

// Reactivar solo se permite si no rompe el límite de asistencias de la
// membresía a la que pertenece (si esa membresía tiene límite): si ya se
// usaron todas las asistencias restantes sin contar esta, reactivarla
// dejaría al cliente con más accesos de los que pagó.
async function reactivarAsistencia(id_asistencia, { motivo, id_admin }) {
  if (!motivo || !motivo.trim()) {
    return { tipo: 'error', error: 'El motivo de la reactivación es obligatorio' };
  }
  if (!id_admin) {
    return { tipo: 'error', error: 'Falta el administrativo responsable de la reactivación' };
  }

  const transaction = await sequelize.transaction();
  try {
    // Se bloquea solo la fila de asistencias (sin JOIN): Postgres no permite
    // "FOR UPDATE" sobre el lado nullable de un LEFT JOIN, y id_registro es
    // opcional. La membresía relacionada se consulta aparte, después.
    const asistencia = await Asistencia.scope('withInactive').findByPk(id_asistencia, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!asistencia) {
      await transaction.rollback();
      return { tipo: 'no_encontrado', error: 'Asistencia no encontrada' };
    }
    if (asistencia.activo) {
      await transaction.rollback();
      return { tipo: 'error', error: 'Esta asistencia ya está activa' };
    }

    const registro = asistencia.id_registro
      ? await RegistroMembresia.scope('withInactive').findByPk(asistencia.id_registro, { transaction })
      : null;
    if (registro && registro.limite_asistencias !== null) {
      const usadas = await contarUsoMembresia(registro.id_registro, { transaction });
      if (usadas >= registro.limite_asistencias) {
        await transaction.rollback();
        return {
          tipo: 'error',
          error: `No se puede reactivar: la membresía ya tiene ${usadas}/${registro.limite_asistencias} asistencias activas usadas. Reactivar esta superaría el límite contratado.`
        };
      }
    }

    const datosAnteriores = asistencia.toJSON();
    await asistencia.update({ activo: true, fecha_actualizacion: new Date() }, { transaction });

    await AuditoriaAsistencia.create({
      id_asistencia: asistencia.id_asistencia,
      id_admin,
      accion: 'REACTIVACION',
      motivo: motivo.trim(),
      datos_anteriores: datosAnteriores,
      datos_nuevos: asistencia.toJSON()
    }, { transaction });

    await transaction.commit();
    return { tipo: 'ok', asistencia };
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

// Listado con filtros combinables y paginación desde backend, usado tanto
// por la pestaña "Hoy" (con fechaInicio=fechaFin=hoy) como por "Historial".
async function listarAsistencias({
  page = 1,
  pageSize = 10,
  fechaInicio,
  fechaFin,
  metodo,
  estado, // 'activas' | 'anuladas' | 'todas'
  id_admin,
  busqueda,
  id_usuario
} = {}) {
  const where = {};
  const usuarioWhere = {};

  if (fechaInicio) {
    const [a, m, d] = fechaInicio.split('-').map(Number);
    where.fecha_hora = { ...(where.fecha_hora || {}), [Op.gte]: medianocheBoliviaUTC(a, m - 1, d) };
  }
  if (fechaFin) {
    const [a, m, d] = fechaFin.split('-').map(Number);
    where.fecha_hora = { ...(where.fecha_hora || {}), [Op.lt]: medianocheBoliviaUTC(a, m - 1, d + 1) };
  }
  if (metodo && metodo !== 'todos') where.metodo = metodo;
  if (id_admin) where.id_admin = id_admin;
  if (id_usuario) where.id_usuario = id_usuario;
  if (estado === 'activas') where.activo = true;
  else if (estado === 'anuladas') where.activo = false;
  // estado === 'todas' o ausente: sin filtro (se usa el scope withInactive más abajo)

  if (busqueda && busqueda.trim()) {
    const termino = `%${busqueda.trim()}%`;
    usuarioWhere[Op.or] = [
      { nombre: { [Op.iLike]: termino } },
      { apellido: { [Op.iLike]: termino } },
      { telefono: { [Op.iLike]: termino } }
    ];
  }

  const limit = Math.min(Math.max(parseInt(pageSize) || 10, 1), 100);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

  const { count, rows } = await Asistencia.scope('withInactive').findAndCountAll({
    where,
    include: [
      {
        model: Usuario.scope('withInactive'),
        as: 'Usuario',
        attributes: ['id_usuario', 'nombre', 'apellido', 'telefono'],
        where: Object.keys(usuarioWhere).length ? usuarioWhere : undefined,
        required: Object.keys(usuarioWhere).length > 0
      },
      {
        model: RegistroMembresia.scope('withInactive'),
        as: 'RegistroMembresia',
        include: [{ model: Membresia.scope('withInactive'), as: 'Membresia', attributes: ['id_membresia', 'tipo', 'limite_asistencias'] }]
      },
      { model: Administrativo.scope('withInactive'), as: 'Administrativo', attributes: ['id_admin', 'nombre', 'apellido'] }
    ],
    order: [['fecha_hora', 'DESC']],
    limit,
    offset,
    distinct: true
  });

  return { rows, total: count, page: Math.max(parseInt(page) || 1, 1), pageSize: limit };
}

function rangoFechas(fechaInicio, fechaFin) {
  const hoy = fechaHoyBolivia();
  const inicioStr = fechaInicio || hoy;
  const finStr = fechaFin || hoy;
  const [ai, mi, di] = inicioStr.split('-').map(Number);
  const [af, mf, df] = finStr.split('-').map(Number);
  return {
    inicio: medianocheBoliviaUTC(ai, mi - 1, di),
    fin: medianocheBoliviaUTC(af, mf - 1, df + 1),
    inicioStr,
    finStr
  };
}

// Indicadores rápidos del día, para la pestaña "Asistencia rápida"/"Hoy".
async function estadisticasHoy() {
  const hoy = fechaHoyBolivia();
  const [a, m, d] = hoy.split('-').map(Number);
  const inicio = medianocheBoliviaUTC(a, m - 1, d);
  const fin = medianocheBoliviaUTC(a, m - 1, d + 1);
  const where = { fecha_hora: { [Op.gte]: inicio, [Op.lt]: fin } };

  const [total, qr, manual, clientesAtendidos, membresiasPorVencer] = await Promise.all([
    Asistencia.count({ where }),
    Asistencia.count({ where: { ...where, metodo: 'QR' } }),
    Asistencia.count({ where: { ...where, metodo: 'Manual' } }),
    Asistencia.count({ where, distinct: true, col: 'id_usuario' }),
    RegistroMembresia.count({
      where: {
        activo: true,
        fecha_fin: { [Op.gte]: hoy, [Op.lte]: new Date(Date.UTC(a, m - 1, d + 7)).toISOString().slice(0, 10) }
      }
    })
  ]);

  return { total, qr, manual, clientesAtendidos, membresiasPorVencer, fecha: hoy };
}

// Métricas para la pestaña "Reportes": todo calculado con agregaciones
// reales sobre el rango pedido (nunca se inventan números).
async function reportes({ fechaInicio, fechaFin }) {
  const { inicio, fin, inicioStr, finStr } = rangoFechas(fechaInicio, fechaFin);
  const where = { fecha_hora: { [Op.gte]: inicio, [Op.lt]: fin } };

  const [total, qr, manual, clientesUnicos, filas] = await Promise.all([
    Asistencia.count({ where }),
    Asistencia.count({ where: { ...where, metodo: 'QR' } }),
    Asistencia.count({ where: { ...where, metodo: 'Manual' } }),
    Asistencia.count({ where, distinct: true, col: 'id_usuario' }),
    Asistencia.findAll({
      where,
      include: [{ model: Usuario.scope('withInactive'), as: 'Usuario', attributes: ['id_usuario', 'nombre', 'apellido'] }],
      attributes: ['id_asistencia', 'id_usuario', 'fecha_hora'],
      raw: false
    })
  ]);

  const diasDelRango = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)));
  const promedioDiario = total / diasDelRango;

  const porCliente = new Map();
  const porDia = new Map();
  const porHora = new Map();

  for (const a of filas) {
    const key = a.id_usuario;
    if (!porCliente.has(key)) {
      porCliente.set(key, { id_usuario: key, nombre: a.Usuario?.nombre || '', apellido: a.Usuario?.apellido || '', cantidad: 0 });
    }
    porCliente.get(key).cantidad += 1;

    const dia = claveDiaBolivia(a.fecha_hora);
    porDia.set(dia, (porDia.get(dia) || 0) + 1);

    const hora = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'America/La_Paz' }).format(new Date(a.fecha_hora));
    porHora.set(hora, (porHora.get(hora) || 0) + 1);
  }

  const clientesFrecuencia = [...porCliente.values()].sort((x, y) => y.cantidad - x.cantidad);
  const masFrecuentes = clientesFrecuencia.slice(0, 5);

  const diasConMasAsistencias = [...porDia.entries()]
    .map(([fecha, cantidad]) => ({ fecha, cantidad }))
    .sort((x, y) => y.cantidad - x.cantidad)
    .slice(0, 5);

  const horariosPico = [...porHora.entries()]
    .map(([hora, cantidad]) => ({ hora: `${hora}:00`, cantidad }))
    .sort((x, y) => y.cantidad - x.cantidad)
    .slice(0, 5);

  return {
    rango: { desde: inicioStr, hasta: finStr },
    total,
    qr,
    manual,
    clientesUnicos,
    promedioDiario: Math.round(promedioDiario * 100) / 100,
    masFrecuentes,
    diasConMasAsistencias,
    horariosPico
  };
}

// Clientes activos, con membresía vigente, que no vienen desde hace
// `umbralDias` días (o que nunca asistieron): herramienta de seguimiento,
// no un simple "top de inactivos" -- solo tiene sentido para clientes que
// todavía podrían venir (membresía vigente).
async function clientesBajaFrecuencia(umbralDias = 7) {
  const hoy = fechaHoyBolivia();
  const membresiasVigentes = await RegistroMembresia.findAll({
    where: {
      activo: true,
      [Op.or]: [{ fecha_fin: null }, { fecha_fin: { [Op.gte]: hoy } }]
    },
    include: [
      { model: Usuario.scope('withInactive'), as: 'Usuario', attributes: ['id_usuario', 'nombre', 'apellido'], where: { activo: true } },
      { model: Membresia.scope('withInactive'), as: 'Membresia', attributes: ['tipo'] }
    ]
  });

  const limiteFecha = new Date();
  limiteFecha.setDate(limiteFecha.getDate() - umbralDias);

  const resultado = [];
  for (const registro of membresiasVigentes) {
    const ultima = await Asistencia.findOne({
      where: { id_usuario: registro.id_usuario },
      order: [['fecha_hora', 'DESC']]
    });

    const diasDesde = ultima
      ? Math.floor((Date.now() - new Date(ultima.fecha_hora).getTime()) / (24 * 60 * 60 * 1000))
      : null;

    const calificaPorInactividad = !ultima || (ultima && new Date(ultima.fecha_hora) < limiteFecha);
    if (calificaPorInactividad) {
      resultado.push({
        id_usuario: registro.id_usuario,
        cliente: `${registro.Usuario.nombre} ${registro.Usuario.apellido}`,
        ultimaAsistencia: ultima?.fecha_hora || null,
        diasDesdeUltimaAsistencia: diasDesde,
        membresia: registro.Membresia?.tipo || null,
        vencimiento: registro.fecha_fin
      });
    }
  }

  resultado.sort((a, b) => (b.diasDesdeUltimaAsistencia ?? 999999) - (a.diasDesdeUltimaAsistencia ?? 999999));
  return resultado;
}

module.exports = {
  obtenerMembresiaVigente,
  contarUsoMembresia,
  registrarAsistencia,
  obtenerDetalle,
  editarAsistencia,
  anularAsistencia,
  reactivarAsistencia,
  listarAsistencias,
  estadisticasHoy,
  reportes,
  clientesBajaFrecuencia
};
