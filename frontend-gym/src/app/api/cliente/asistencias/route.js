import { NextResponse } from 'next/server';
import { Asistencia } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

function aClaveDelDia(fecha) {
  // YYYY-MM-DD en hora local, para agrupar/comparar días sin líos de zona horaria
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Suficiente historial para calcular la racha actual sin traer toda la tabla
    const asistencias = await Asistencia.findAll({
      where: { id_usuario: auth.id_usuario },
      order: [['fecha_hora', 'DESC']],
      limit: 200
    });

    const diasUnicos = [...new Set(asistencias.map(a => aClaveDelDia(a.fecha_hora)))].sort().reverse();

    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();
    const totalMes = diasUnicos.filter(dia => {
      const [y, m] = dia.split('-').map(Number);
      return y === anioActual && m === mesActual + 1;
    }).length;

    // Racha: días consecutivos con asistencia, contando hacia atrás desde hoy
    // (se permite que "hoy" todavía no tenga asistencia sin romper la racha).
    let racha = 0;
    const cursor = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const diasSet = new Set(diasUnicos);
    if (!diasSet.has(aClaveDelDia(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (diasSet.has(aClaveDelDia(cursor))) {
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return NextResponse.json({
      totalMes,
      racha,
      ultimaVisita: asistencias[0]?.fecha_hora ?? null,
      diasDelMes: diasUnicos.filter(dia => {
        const [y, m] = dia.split('-').map(Number);
        return y === anioActual && m === mesActual + 1;
      })
    });
  } catch (error) {
    console.error('Error al obtener asistencias de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
