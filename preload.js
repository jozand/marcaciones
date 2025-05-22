const { contextBridge, ipcRenderer } = require('electron');
const os   = require('os');
const path = require('path');
const { usuariosGafete } = require(path.join(__dirname, 'usuarios.js'));

/* ------------ API BioTime (canales IPC) ------------------------------ */
contextBridge.exposeInMainWorld('api', {
  ensureToken                 : ()                     => ipcRenderer.invoke('bt:token'),
  obtenerMarcaciones          : (e,i,f)                => ipcRenderer.invoke('bt:marc', e,i,f),
  obtenerEmpleadoDesdePersonnel: (e)                   => ipcRenderer.invoke('bt:empleado', e),
  obtenerReporteAsistencia    : (id,i,f)               => ipcRenderer.invoke('bt:reporte', id,i,f),
  obtenerPermisos             : (e,i,f,p=1,l=27)       => ipcRenderer.invoke('bt:permisos', e,i,f,p,l)
});

/* ------------ Gafete de usuario -------------------------------------- */
contextBridge.exposeInMainWorld('usuario', {
  obtenerGafete: () => {
    const username = os.userInfo().username.toUpperCase();
    return usuariosGafete[username] || null;
  }
});
