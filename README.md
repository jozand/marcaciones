marcaciones/
├── .env                         # Contiene API_URL
├── main.js                     # Archivo principal de Electron
├── preload.js                  # Preload que expone funciones seguras
├── package.json                # Configuración del proyecto y dependencias
│
├── src/
│   ├── api/
│   │   └── biotimeApi.js       # Funciones para login y obtener marcaciones
│
│   ├── views/
│   │   └── index.html          # Pantalla con formulario, tabla y scripts
│
│   └── renderer/
│       └── renderer.js         # Lógica del formulario y renderizado de tabla
