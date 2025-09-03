// bioTimeClient.js (proceso principal)
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/* ── 1. Cargar lógica de BioTime ----------------------------- */
const bt = require(path.join(__dirname, 'src', 'api', 'biotime.js'));

/* ── 2. Leer configuración cifrada o de respaldo ------------- */
function cargarConfig() {
  const dir = app.getAppPath();
  const encPath = path.join(dir, 'config.enc');
  const jsonPath = path.join(dir, 'config.json');

  // a) Descifrar config.enc
  if (fs.existsSync(encPath)) {
    try {
      const bin = fs.readFileSync(encPath);
      const key = crypto.scryptSync('Org@n!ism0-Jud!ciAl', 'salt', 32);
      const iv = bin.slice(0, 16);
      const data = bin.slice(16);

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const plain = Buffer.concat([decipher.update(data), decipher.final()]);
      return JSON.parse(plain.toString());
    } catch (err) {
      console.warn('⚠️  No se pudo descifrar config.enc:', err.message);
    }
  }

  // b) Fallback: config.json
  if (fs.existsSync(jsonPath)) {
    try {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (err) {
      console.warn('⚠️  Error leyendo config.json:', err.message);
    }
  }

  // c) Último recurso: variables de entorno
  if (process.env.API_URL && process.env.API_USER && process.env.API_PASS) {
    return {
      API_URL: process.env.API_URL,
      API_USER: process.env.API_USER,
      API_PASS: process.env.API_PASS
    };
  }

  // d) Sin configuración válida → error fatal
  throw new Error('❌ No se encontró configuración válida (config.enc / json / .env)');
}

const cfg = cargarConfig();

/* ── 3. Exponer funciones vía IPC (Electron) ----------------- */
ipcMain.handle('bt:token', () => bt.ensureToken(cfg));

ipcMain.handle('bt:marc', (_e, emp, ini, fin) =>
  bt.obtenerMarcaciones(cfg, emp, ini, fin)
);

ipcMain.handle('bt:empleado', (_e, emp) =>
  bt.obtenerEmpleadoDesdePersonnel(cfg, emp)
);

ipcMain.handle('bt:reporte', (_e, id, ini, fin) =>
  bt.obtenerReporteAsistencia(cfg, id, ini, fin)
);

ipcMain.handle('bt:permisos', (_e, emp, ini, fin, p = 1, l = 27) =>
  bt.obtenerPermisos(cfg, emp, ini, fin, p, l)
);

ipcMain.handle('bt:empleados', (_e, opts = {}) => bt.obtenerEmpleados(cfg, opts));

ipcMain.handle('bt:reporteTodos', (_e, ini, fin, dept = 2) =>
  bt.obtenerReporteTodos(cfg, ini, fin, dept)
);

