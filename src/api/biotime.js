// src/api/biotime.js
const fetchBase     = require('electron-fetch').default;
const fetchCookie   = require('fetch-cookie').default;
const { CookieJar } = require('tough-cookie');
const jar           = new CookieJar();
const fetch         = fetchCookie(fetchBase, jar);

let tokenCache     = null;
let sessionExpireAt = 0;

async function ensureToken(config) {
  if (tokenCache) return tokenCache;
  const res = await fetch(`${config.API_URL}/jwt-api-token-auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: config.API_USER,
      password: config.API_PASS
    })
  });
  if (!res.ok) throw new Error(`JWT auth failed: ${res.status}`);
  const { token } = await res.json();
  tokenCache = token;
  return token;
}

async function ensureSession(config) {
  if (Date.now() < sessionExpireAt) return jar;

  const loginUrl = `${config.API_URL}/login/`;

  // 1) GET la página de login
  const page = await fetch(loginUrl, { method: 'GET', credentials: 'include' });
  const html = await page.text(); 

  // Extrae el CSRF
  const m = html.match(/name=['"]csrfmiddlewaretoken['"][^>]*value=['"]([^'"]+)/i);
  if (!m) throw new Error('csrfmiddlewaretoken no encontrado en /login/');
  const fullToken = m[1];

  // 2) POST credenciales
  const post = await fetch(loginUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': loginUrl,
      'X-CSRFToken': fullToken.slice(0,32)
    },
    body: new URLSearchParams({
      username: config.API_USER,
      password: config.API_PASS,
      csrfmiddlewaretoken: fullToken
    }),
    redirect: 'manual'
  });

  // 3) Inspecciona las cookies en tu CookieJar
  // Si estés usando tough-cookie@5, puedes hacer:
  const cookiesAfterPost = jar.getCookiesSync
    ? jar.getCookiesSync(config.API_URL)
    : await new Promise(r => jar.getCookies(config.API_URL, {}, (_,c)=>r(c)));

  // 4) Ahora lanza tu excepción si no existe sessionid
  if (!cookiesAfterPost.some(c => c.key === 'sessionid')) {
    throw new Error('No llegó sessionid tras login');
  }

  sessionExpireAt = Date.now() + 2 * 3600 * 1000;
  return jar;
}


async function obtenerPermisos(config, empCode, ini, fin, page = 1, limit = 27) {
  await ensureSession(config);

  // Sumar 5 días a la fecha `fin`
  const fechaFin = new Date(fin);
  fechaFin.setDate(fechaFin.getDate() + 5);
  const finAjustado = fechaFin.toISOString().split('T')[0]; // formato YYYY-MM-DD

  const url = new URL('/att/leave/table/', config.API_URL);
  url.searchParams.set('_p1_employee__emp_code__exact', empCode);
  url.searchParams.set('_p1_start_time__gte', ini);
  url.searchParams.set('_p1_start_time__lt', finAjustado);
  url.searchParams.set('page', page);
  url.searchParams.set('limit', limit);

  const res = await fetch(url.href);
  if (res.status === 302) {
    sessionExpireAt = 0;
    return obtenerPermisos(config, empCode, ini, fin, page, limit);
  }

  if (!res.ok) throw new Error(`Permisos ${res.status}`);
  return (await res.json()).data;
}


async function obtenerMarcaciones(config, empCode, start, end) {
  const token = await ensureToken(config);
  const endpoint = `${config.API_URL}/iclock/api/transactions/`
    + `?emp_code=${empCode}`
    + `&start_time=${encodeURIComponent(start)}`
    + `&end_time=${encodeURIComponent(end)}`;
  const res = await fetch(endpoint, {
    headers: { Authorization: `JWT ${token}` }
  });
  if (!res.ok) throw new Error(`Marcaciones ${res.status}`);
  return (await res.json()).data;
}

async function obtenerEmpleadoDesdePersonnel(config, empCode) {
  const token = await ensureToken(config);
  const url = `${config.API_URL}/personnel/api/employee/?emp_code=${empCode}`;
  const res = await fetch(url, {
    headers: { Authorization: `JWT ${token}` }
  });
  if (!res.ok) throw new Error(`Personnel ${res.status}`);
  const json = await res.json();
  if (!json.count) throw new Error(`Empleado ${empCode} no encontrado`);
  return json.data[0];
}

async function obtenerReporteAsistencia(config, employeeId, startDate, endDate) {
  const token = await ensureToken(config);
  const url = `${config.API_URL}/att/api/firstLastReport/`
    + `?employees=${employeeId}`
    + `&start_date=${startDate}`
    + `&end_date=${endDate}`
    + `&page=1&page_size=100&time_table=0&departments=-1`;
  const res = await fetch(url, {
    headers: { Authorization: `JWT ${token}` }
  });
  if (!res.ok) throw new Error(`ReportAsistencia ${res.status}`);
  return (await res.json()).data;
}

module.exports = {
  ensureToken,
  ensureSession,
  obtenerPermisos,
  obtenerMarcaciones,
  obtenerEmpleadoDesdePersonnel,
  obtenerReporteAsistencia
};
