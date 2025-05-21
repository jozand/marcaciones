const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    sandbox: false
    }
  });
  
  //win.removeMenu();

  win.loadFile(path.join(__dirname, 'src/views/index.html'));
}

app.whenReady().then(createWindow);