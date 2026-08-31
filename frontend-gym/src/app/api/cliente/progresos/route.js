import { NextResponse } from 'next/server';
import { Progreso, Meta } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

// Palabras clave para relacionar el texto libre de "tipo_meta" con el campo
// de la medición que le corresponde. Permite que el avance de una meta
// ("Bajar de peso", "Reducir cintura", ...) se actualice solo al registrar
// una nueva medición, sin que el cliente tenga que tocar la meta a mano.
const CAMPOS_POR_PALABRA_CLAVE = [
  { palabras: ['grasa'], campo: 'porcentaje_grasa' },
  { palabras: ['peso', 'kilo', 'kg'], campo: 'peso' },
  { palabras: ['cintura', 'abdomen', 'abdominal'], campo: 'cintura' },
  { palabras: ['pecho', 'torax', 'tórax'], campo: 'pecho' },
  { palabras: ['brazo', 'biceps', 'bíceps'], campo: 'brazo' },
  { palabras: ['pierna', 'muslo', 'cuadriceps', 'cuádriceps'], campo: 'pierna' },
  { palabras: ['cadera', 'gluteo', 'glúteo'], campo: 'cadera' },
];

function campoParaTipoMeta(tipoMeta) {
  const texto = (tipoMeta || '').toLowerCase();
  const match = CAMPOS_POR_PALABRA_CLAVE.find(({ palabras }) =>
    palabras.some((palabra) => texto.includes(palabra))
  );
  return match?.campo ?? null;
}

// Actualiza automáticamente valor_actual (y, si corresponde, marca la meta
// como cumplida) de las metas activas del usuario cuyo tipo coincide con
// alguno de los campos registrados en la nueva medición.
async function sincronizarMetasConProgreso(idUsuario, progreso) {
  const metasActivas = await Meta.findAll({
    where: { id_usuario: idUsuario, estado: 'activa' },
  });

  for (const meta of metasActivas) {
    const campo = campoParaTipoMeta(meta.tipo_meta);
    if (!campo) continue;

    const nuevoValor = progreso[campo];
    if (nuevoValor === null || nuevoValor === undefined) continue;

    const valorActual = parseFloat(nuevoValor);
    const updateData = { valor_actual: valorActual };

    const inicial = meta.valor_inicial !== null ? parseFloat(meta.valor_inicial) : null;
    const objetivo = meta.valor_objetivo !== null ? parseFloat(meta.valor_objetivo) : null;
    if (inicial !== null && objetivo !== null && objetivo !== inicial) {
      const direccion = objetivo - inicial;
      const alcanzada = direccion > 0 ? valorActual >= objetivo : valorActual <= objetivo;
      if (alcanzada) updateData.estado = 'cumplida';
    }

    await meta.update(updateData);
  }
}

export async function GET(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const progresos = await Progreso.findAll({
      where: { id_usuario: auth.id_usuario },
      order: [['fecha', 'DESC']]
    });
    return NextResponse.json(progresos);
  } catch (error) {
    console.error('Error al obtener progresos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { peso, porcentaje_grasa, pecho, cintura, brazo, pierna, cadera, observaciones } = await request.json();

    if (peso === undefined && porcentaje_grasa === undefined && !pecho && !cintura && !brazo && !pierna && !cadera) {
      return NextResponse.json({ error: 'Registra al menos una medición' }, { status: 400 });
    }

    const progreso = await Progreso.create({
      id_usuario: auth.id_usuario,
      peso,
      porcentaje_grasa,
      pecho,
      cintura,
      brazo,
      pierna,
      cadera,
      observaciones
    });

    await sincronizarMetasConProgreso(auth.id_usuario, progreso);

    return NextResponse.json(progreso, { status: 201 });
  } catch (error) {
    console.error('Error al crear progreso:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
