const { app, BrowserWindow } = require('electron');
const path = require('path');
require('./bioTimeClient.js');

function createWindow() {
  // main.js
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,    // explícito
      sandbox: false
    }
  });


  win.maximize();
  win.removeMenu();  
  win.loadFile(path.join(__dirname, 'src/views/index.html'));
}

app.whenReady().then(createWindow);
