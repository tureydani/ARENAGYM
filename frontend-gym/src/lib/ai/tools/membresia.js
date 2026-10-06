import { RegistroMembresia, Membresia } from '@/lib/db/models';

// Membresía vigente del cliente identificado (requiere id_usuario, es decir
// el chat ya debe estar vinculado). Nunca se inventa esta info desde el JSON.
async function consultarMembresia(idUsuario) {
  const registro = await RegistroMembresia.findOne({
    where: { id_usuario: idUsuario },
    include: [{ model: Membresia, as: 'Membresia' }],
    order: [['fecha_inicio', 'DESC']]
  });

  if (!registro) {
    return { tiene_membresia: false };
  }

  const hoy = new Date();
  const fin = registro.fecha_fin ? new Date(registro.fecha_fin) : null;
  const activa = registro.activo && (!fin || fin >= hoy);
  const diasRestantes = fin
    ? Math.max(0, Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    tiene_membresia: true,
    activa,
    tipo: registro.Membresia?.tipo ?? null,
    fecha_inicio: registro.fecha_inicio,
    fecha_fin: registro.fecha_fin,
    dias_restantes: diasRestantes,
    limite_asistencias: registro.limite_asistencias
  };
}

// Planes y precios vigentes (información pública, no requiere cliente
// identificado). Se consulta siempre en vivo: nunca hardcodear precios.
async function consultarPlanes() {
  const planes = await Membresia.findAll({
    attributes: ['tipo', 'duracion_dias', 'precio', 'limite_asistencias']
  });

  return planes.map((p) => ({
    tipo: p.tipo,
    duracion_dias: p.duracion_dias,
    precio: Number(p.precio),
    limite_asistencias: p.limite_asistencias
  }));
}

export { consultarMembresia, consultarPlanes };
