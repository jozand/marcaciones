/* preload.js */
const { contextBridge, ipcRenderer } = require('electron');
const os   = require('os');

/* ⇣⇣⇣  Usa './' si están al lado, o  'data/usuarios.js'  según tu estructura */
const { usuariosGafete } = require('./usuarios.js');
const { infoEmpleados  } = require('./usuarios.js');

function porGafete(g)  { return infoEmpleados.find(e => e.gafete  === Number(g)) || null; }
function porUsuario(u) { return infoEmpleados.find(e => e.usuario === u.toUpperCase()) || null; }

/* IPC BioTime */
contextBridge.exposeInMainWorld('api', {
  ensureToken  : ()               => ipcRenderer.invoke('bt:token'),
  obtenerMarcaciones: (e,i,f)     => ipcRenderer.invoke('bt:marc',    e,i,f),
  obtenerEmpleadoDesdePersonnel: e=> ipcRenderer.invoke('bt:empleado',e),
  obtenerReporteAsistencia:(id,i,f)=> ipcRenderer.invoke('bt:reporte', id,i,f),
  obtenerPermisos:(e,i,f,p=1,l=27)=> ipcRenderer.invoke('bt:permisos',e,i,f,p,l)
});

/* Gafete basado en la cuenta de Windows */
contextBridge.exposeInMainWorld('usuario', {
  obtenerGafete() {
    const username = os.userInfo().username.toUpperCase();
    return usuariosGafete[username] ?? null;
  }
});

/* Catálogo para el renderer */
contextBridge.exposeInMainWorld('catalogo', {
  empleados  : infoEmpleados,
  porGafete  : porGafete,
  porUsuario : porUsuario
});

