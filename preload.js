const { contextBridge } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

// 1. Cargar configuración (config.enc o config.json)
function cargarConfig() {
  const pathEnc = path.join(__dirname, 'config.enc');
  const pathJson = path.join(__dirname, 'config.json');

  try {
    if (fs.existsSync(pathEnc)) {
      const encrypted = fs.readFileSync(pathEnc);
      const key = crypto.scryptSync('Org@n!ism0-Jud!ciAl', 'salt', 32);
      const iv = encrypted.slice(0, 16);
      const data = encrypted.slice(16);

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(data);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return JSON.parse(decrypted.toString());
    } else if (fs.existsSync(pathJson)) {
      return JSON.parse(fs.readFileSync(pathJson, 'utf8'));
    } else {
      throw new Error('No se encontró configuración');
    }
  } catch (err) {
    console.error('❌ Error al cargar config:', err.message);
    return {};
  }
}

const config = cargarConfig();

// 2. Cargar módulo de API
const apiPath = path.join(__dirname, 'src', 'api', 'biotime.js');
const api = require(apiPath);

// 3. Cargar mapa de usuarios
const usuariosPath = path.join(__dirname, 'usuarios.js');
const { usuariosGafete } = require(usuariosPath);

// 4. Exponer funciones API pasándole el config desencriptado
contextBridge.exposeInMainWorld('api', {
  ensureToken: () => api.ensureToken(config),
  obtenerMarcaciones: (emp, start, end) => api.obtenerMarcaciones(config, emp, start, end),
  obtenerEmpleadoDesdePersonnel: (emp) => api.obtenerEmpleadoDesdePersonnel(config, emp),
  obtenerReporteAsistencia: (id, start, end) => api.obtenerReporteAsistencia(config, id, start, end),
});

// 5. Exponer el gafete detectado por usuario de red
contextBridge.exposeInMainWorld('usuario', {
  obtenerGafete: () => {
    const username = os.userInfo().username.toUpperCase();
    return usuariosGafete[username] || null;
  }
});

// 6. También exponer el config por si lo necesitas en renderer
contextBridge.exposeInMainWorld('config', {
  apiUrl: config.API_URL,
  apiUser: config.API_USER,
  apiPass: config.API_PASS
});
