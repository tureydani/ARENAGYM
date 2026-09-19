// EJECUCIÓN REAL: cierra las 4 cajas históricas vía POST /api/cajas/[id]/cerrar
// (el endpoint real de la app). Se corre una sola vez, con los valores
// exactos confirmados por el usuario.
const fs = require('fs');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3055';
const TOKEN = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE || '/tmp/token.json', 'utf-8')).token;
const ID_ADMIN = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE || '/tmp/token.json', 'utf-8')).id_admin;

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const CIERRES = [
  { id_caja: 1, saldo_contado: 8080.00 },
  { id_caja: 2, saldo_contado: 0.00 },
  { id_caja: 3, saldo_contado: 88.90 },
  { id_caja: 4, saldo_contado: 0.00 }
];

async function main() {
  console.log('Admin usado para el cierre: id_admin =', ID_ADMIN);
  for (const c of CIERRES) {
    const res = await api('POST', `/api/cajas/${c.id_caja}/cerrar`, {
      saldo_contado: c.saldo_contado,
      id_admin: ID_ADMIN
    });
    console.log(`\nCierre caja #${c.id_caja} (contado=${c.saldo_contado}):`);
    console.log('  status:', res.status);
    console.log('  respuesta:', JSON.stringify(res.data, null, 2));
    if (res.status !== 200) {
      console.error(`\n⚠ FALLÓ el cierre de la caja #${c.id_caja}. Deteniendo el proceso, no se intentan los siguientes cierres.`);
      process.exit(1);
    }
  }
  console.log('\n✓ Los 4 cierres se ejecutaron con status 200.');
}
main().catch(e => { console.error(e); process.exit(1); });
