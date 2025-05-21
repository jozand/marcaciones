const fetch = global.fetch;
let tokenCache = null;

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
  obtenerReporteAsistencia
};
