/* preload.js */
const { contextBridge, ipcRenderer } = require('electron');
const os   = require('os');

// Importa tus tres datos desde el mismo módulo
const { 
  usuariosGafete,  // objeto account→gafete
  pools,           // objeto account→array<account>
  infoEmpleados    // array de {gafete,nombre,puesto,usuario}
} = require('./usuarios.js');

/** Helpers internos para buscar en infoEmpleados */
function porGafete(g)  { 
  return infoEmpleados.find(e => e.gafete === Number(g)) || null;
}
function porUsuario(u) { 
  return infoEmpleados.find(e => e.usuario === u.toUpperCase()) || null;
}

/** Devuelve array de objetos infoEmpleados si eres supervisor */
function obtenerPoolInfo() {
  const acc = os.userInfo().username.toUpperCase();
  const lista = pools[acc];            // p.e. ['DPALMA','WAVELASQUEZ',…]
  if (!lista) return null;
  return lista
    .map(u => porUsuario(u))
    .filter(Boolean);
}

/** Devuelve tu propio objeto de infoEmpleados */
function obtenerMiInfo() {
  const acc = os.userInfo().username.toUpperCase();
  return porUsuario(acc);
}

/** Devuelve tu gafete crudo (string) */
function obtenerGafete() {
  const acc = os.userInfo().username.toUpperCase();
  return usuariosGafete[acc] ?? null;
}

/* ---------------------------------------------------------------
 *  1) API de BioTime
 * ------------------------------------------------------------- */
contextBridge.exposeInMainWorld('api', {
  ensureToken                 : ()               => ipcRenderer.invoke('bt:token'),
  obtenerMarcaciones          : (e,i,f)          => ipcRenderer.invoke('bt:marc',    e,i,f),
  obtenerEmpleadoDesdePersonnel: e               => ipcRenderer.invoke('bt:empleado',e),
  obtenerReporteAsistencia    : (id,i,f)         => ipcRenderer.invoke('bt:reporte', id,i,f),
  obtenerPermisos             : (e,i,f,p=1,l=27)=> ipcRenderer.invoke('bt:permisos',e,i,f,p,l),
  obtenerEmpleados: (opts = {}) => ipcRenderer.invoke('bt:empleados', opts),
  obtenerReporteTodos: (ini, fin, dept = 2) =>
  ipcRenderer.invoke('bt:reporteTodos', ini, fin, dept)
});

/* ---------------------------------------------------------------
 *  2) Usuario / Pools
 * ------------------------------------------------------------- */
contextBridge.exposeInMainWorld('usuario', {
  obtenerGafete,    // string | null
  obtenerMiInfo,    // {gafete,nombre,puesto,usuario} | null
  obtenerPoolInfo   // Array<{gafete,nombre,puesto,usuario}> | null
});

/* ---------------------------------------------------------------
 *  3) Catálogo completo
 * ------------------------------------------------------------- */
contextBridge.exposeInMainWorld('catalogo', {
  empleados : infoEmpleados,
  porGafete,
  porUsuario
});
