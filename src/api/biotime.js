const fetch = global.fetch;
let tokenCache = null;

/* --- utilidades para manejar cookies cross-runtime -------------------- */
function getCookiesArray(headers) {
  if (typeof headers.getSetCookie === 'function')     // fetch nativo (Undici)
    return headers.getSetCookie();                    // array | []
  if (typeof headers.raw === 'function')              // node-fetch
    return headers.raw()['set-cookie'] ?? [];
  const c = headers.get('set-cookie');
  return c ? [c] : [];
}
function mergeCookies(...lists) {
  return lists
    .flat()
    .filter(Boolean)
    .map(c => c.split(';')[0])    // sólo «nombre=valor»
    .join('; ');
}

// ---------------------------------------------------------------------------
//  ensureSession – login headless para builds 2022 (csrftoken en HTML)
// ---------------------------------------------------------------------------
let sessionCookie   = null;   // «sessionid=…; csrftoken=…»
let sessionExpireAt = 0;      // epoch ms

async function ensureSession(cfg) {
  if (sessionCookie && Date.now() < sessionExpireAt) return sessionCookie;

  /* 1️⃣  GET /login/  → obtenemos el HTML con el token CSRF */
  const r1 = await fetch(`${cfg.API_URL}/login/`);
  if (!r1.ok) throw new Error(`GET /login/ ${r1.status}`);
  const html = await r1.text();

  /* 2️⃣  Extraer el token completo (64 car.) del <input> oculto */
  const m = html.match(/name=['"]csrfmiddlewaretoken['"][^>]*value=['"]([^'"]+)/i);
  if (!m) throw new Error('No se encontró csrfmiddlewaretoken en el HTML');
  const tokenFull = m[1];                     // ej. 'M53qE…vcv4:sha1…'
  const secret32  = tokenFull.slice(0, 32);   // primeros 32 – se usarán en cookie

  /* 3️⃣  Cookies iniciales que pudo enviar el servidor */
  const initCookies = getCookiesArray(r1.headers);
  const yaTraeCsrf  = initCookies.some(c => c.startsWith('csrftoken='));

  /* 4️⃣  Construir cabecera Cookie para el POST */
  const cookieHeader = mergeCookies(
    initCookies,
    yaTraeCsrf ? [] : [`csrftoken=${secret32}`]  // fabricamos csrftoken si no vino
  );

  /* 5️⃣  POST /login/ con token y credenciales */
  const r2 = await fetch(`${cfg.API_URL}/login/`, {
    method : 'POST',
    redirect: 'manual',
    headers: {
      'content-type'    : 'application/x-www-form-urlencoded',
      'cookie'          : cookieHeader,          // csrftoken=<32c>
      'x-csrftoken'     : secret32,              // ← aquí el cambio
      'referer'         : `${cfg.API_URL}/login/`,
      'origin'          : cfg.API_URL,
      'x-requested-with': 'XMLHttpRequest',
      'accept'          : 'application/json, text/javascript, */*; q=0.01',
      'user-agent'      : 'Electron'
    },
    body: new URLSearchParams({
      username            : cfg.API_USER,
      password            : cfg.API_PASS,
      csrfmiddlewaretoken : tokenFull,           // 64c (se queda igual)
      login_type          : 'pwd'
    })
  });

  if (!r2.ok) throw new Error(`POST /login/ ${r2.status}`);

  /* 6️⃣  Capturar sessionid devuelto */
  const finCookies = getCookiesArray(r2.headers);
  const sesPair    = finCookies.find(c => c.startsWith('sessionid='));
  if (!sesPair) throw new Error('No llegó sessionid tras login');

  /* 7️⃣  Guardar sessionid + csrftoken (secret32) para próximas peticiones */
  sessionCookie = mergeCookies(sesPair, `csrftoken=${secret32}`);

  const ttl = /expires=([^;]+)/i.exec(sesPair);
  sessionExpireAt = ttl ? Date.parse(ttl[1]) : Date.now() + 2 * 60 * 60 * 1e3; // 2 h

  return sessionCookie;
}

   
async function obtenerPermisos(cfg, empCode, ini, fin, page = 1, limit = 27) {
  const cookie = await ensureSession(cfg);

  const url = new URL('/att/leave/table/', cfg.API_URL);
  url.searchParams.set('_p1_employee__emp_code__exact', empCode);
  url.searchParams.set('_p1_start_time__gte', ini);
  url.searchParams.set('_p1_start_time__lt',  fin);
  url.searchParams.set('page', page);
  url.searchParams.set('limit', limit);

  const res = await fetch(url, { headers: { Cookie: cookie } });

  // Si la sesión caducó BioTime redirige (302) a /login/
  if (res.status === 302) {
    sessionCookie = null;              // invalida cache y reintenta
    return obtenerPermisos(cfg, empCode, ini, fin, page, limit);
  }
  if (!res.ok) throw new Error(`Permisos ${res.status}`);

  const json = await res.json();
  return json.data;                    // ⬅️ array de permisos
}


async function ensureToken(config) {
  if (tokenCache) return tokenCache;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${config.API_URL}/jwt-api-token-auth/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: config.API_USER, password: config.API_PASS }),
      signal: controller.signal
    });

    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { token } = await res.json();
    tokenCache = token;
    return token;
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`No se pudo autenticar: ${err.message}`);
  }
}


/**
 * Obtiene las marcaciones crudas para un empleado.
 */
async function obtenerMarcaciones(config, empCode, start, end) {
  const token = await ensureToken(config);
  const url = `${config.API_URL}/iclock/api/transactions/?emp_code=${empCode}&start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`;

  const res = await fetch(url, {
    headers: { Authorization: `JWT ${token}` }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

/**
 * Paso 1: Obtener ID del empleado usando emp_code
 */
async function obtenerEmpleadoDesdePersonnel(config, empCode) {
  if (typeof empCode !== 'string') {
    throw new Error(`Parámetro empCode inválido: ${JSON.stringify(empCode)}`);
  }

  const token = await ensureToken(config);
  const url = `${config.API_URL}/personnel/api/employee/?emp_code=${empCode}`;

  const res = await fetch(url, {
    headers: { Authorization: `JWT ${token}` }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  if (json.count === 0 || !json.data.length) {
    throw new Error(`Empleado con código ${empCode} no encontrado`);
  }

  return json.data[0];
}

/**
 * Paso 2: Obtener reporte diario usando el ID
 */
async function obtenerReporteAsistencia(config, employeeId, startDate, endDate) {
  const token = await ensureToken(config);

  

  const url = `${config.API_URL}/att/api/firstLastReport/?employees=${employeeId}&start_date=${startDate}&end_date=${endDate}&page=1&page_size=100&time_table=0&departments=-1`;

  const res = await fetch(url, {
    headers: { Authorization: `JWT ${token}` }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}


/**
 * Función principal para obtener el reporte de asistencia
 */

module.exports = {
  ensureToken,
  obtenerMarcaciones,
  obtenerEmpleadoDesdePersonnel,
  obtenerReporteAsistencia,
  obtenerPermisos
};
