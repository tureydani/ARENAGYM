const fs = require('fs');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3055';
const TOKEN = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE || '/tmp/token.json', 'utf-8')).token;
const ID_ADMIN = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE || '/tmp/token.json', 'utf-8')).id_admin;

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function main() {
  const res = await api('POST', '/api/cajas/abrir', {
    descripcion: 'Recepción',
    saldo_inicial: 200.00,
    id_admin: ID_ADMIN
  });
  console.log('status:', res.status);
  console.log(JSON.stringify(res.data, null, 2));
  if (res.status !== 201) {
    console.error('⚠ FALLÓ la apertura de la nueva jornada.');
    process.exit(1);
  }
  fs.writeFileSync('/tmp/jornada_recepcion.json', JSON.stringify(res.data));
}
main().catch(e => { console.error(e); process.exit(1); });
