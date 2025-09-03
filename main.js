const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
require('./bioTimeClient.js');

// 🔐 Lista de usuarios autorizados
const allowedUsers = ['JAJCAN', 'RDALVARADO','ESTUARDO.CARDENAS'];  // puedes usar nombres en mayúsculas

// 👤 Detectar usuario del sistema
function getSystemUser() {
  return (
    process.env.USER ||         // macOS/Linux
    process.env.USERNAME ||     // Windows
    'desconocido'
  ).toUpperCase();
}

function createWindow() {
  const usuario = getSystemUser();

  // Validar usuario contra lista blanca
  if (!allowedUsers.includes(usuario)) {
    dialog.showErrorBox(
      'Acceso Denegado',
      `El usuario "${usuario}" no tiene permisos para usar esta aplicación.`
    );
    app.quit();  // ❌ cerrar la app
    return;
  }

  // 🪟 Si tiene acceso, cargar la app
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

   win.maximize();
   win.removeMenu();
  win.loadFile(path.join(__dirname, 'src/views/index.html'));
}

// 🟢 Iniciar app
app.whenReady().then(createWindow);
