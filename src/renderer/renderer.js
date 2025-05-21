const circle = document.getElementById('circle');
const statusSpan = document.getElementById('status');

// Mostrar estado de conexión
window.api.ensureToken()
  .then(() => {
    circle.className = 'w-4 h-4 rounded-full bg-green-500';
    statusSpan.textContent = 'Conectado';
    statusSpan.className = 'text-sm text-green-600';
  })
  .catch(err => {
    circle.className = 'w-4 h-4 rounded-full bg-red-500';
    statusSpan.textContent = `Error: ${err.message}`;
    statusSpan.className = 'text-sm text-red-600';
    console.error('Error de conexión', err);
  });

// Renderizar los datos en tabla
function render(filas) {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';

  filas.forEach((f, index) => {
    const tr = document.createElement('tr');
    tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

    const sinMarcacion = !f.entrada && !f.salida;

    let claseEntrada = 'text-gray-400 italic';
    let claseSalida = 'text-gray-400 italic';

    if (!sinMarcacion) {
      const [hEnt, mEnt] = f.entrada.split(':').map(Number);
      const entradaTardia = hEnt > 8 || (hEnt === 8 && mEnt > 0);

      const [hSal, mSal] = f.salida.split(':').map(Number);
      const salidaTemprano = hSal < 15 || (hSal === 15 && mSal < 30);

      claseEntrada = entradaTardia ? 'text-red-600 font-semibold' : 'text-gray-800';
      claseSalida = salidaTemprano ? 'text-red-600 font-semibold' : 'text-gray-800';
    }

    tr.innerHTML = `
      <td class="border p-3 text-sm text-gray-800 font-medium">${f.dia}</td>
      <td class="border p-3 text-sm ${claseEntrada} text-center">${f.entrada || '-- sin marcación --'}</td>
      <td class="border p-3 text-sm ${claseSalida} text-center">${f.salida || '-- sin marcación --'}</td>
      <td class="border p-3 text-sm text-right ${sinMarcacion ? 'text-gray-400 italic' : 'text-gray-800 font-bold'}">${f.horas || '0.0'} h</td>
    `;
    tbody.appendChild(tr);
  });
}

// Obtener todos los días hábiles del mes en formato dd/MM/yyyy
function obtenerDiasHabilesMes(anio, mes) {
  const dias = [];
  const fecha = new Date(anio, mes - 1, 1);
  while (fecha.getMonth() === mes - 1) {
    const diaSemana = fecha.getDay();
    if (diaSemana >= 1 && diaSemana <= 5) {
      const dd = String(fecha.getDate()).padStart(2, '0');
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
      const yyyy = fecha.getFullYear();
      dias.push(`${dd}/${mm}/${yyyy}`);
    }
    fecha.setDate(fecha.getDate() + 1);
  }
  return dias;
}

// Lógica del botón consultar
document.getElementById('btn').addEventListener('click', async () => {
  const empCode = document.getElementById('emp').value.trim();
  const fi = document.getElementById('fi').value;
  const ff = document.getElementById('ff').value;

  if (!empCode || !fi || !ff) {
    alert('Complete todos los campos');
    return;
  }

  try {
    const empleado = await window.api.obtenerEmpleadoDesdePersonnel(empCode);
    const reporte = await window.api.obtenerReporteAsistencia(empleado.id, fi, ff);

    // Normalizar las fechas del backend: "05-05-2025" => "05/05/2025"
    const mapa = Object.fromEntries(
      reporte.map(d => {
        const [dd, mm, yyyy] = d.att_date.split('-');
        const fecha = `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
        return [
          fecha,
          {
            dia: fecha,
            entrada: d.first_punch || '',
            salida: d.last_punch || '',
            horas: d.total_time?.toFixed(1) || ''
          }
        ];
      })
    );

    // Extraer año y mes desde la fecha inicial (formato YYYY-MM-DD)
    const [anioStr, mesStr] = fi.split('-');
    const anio = parseInt(anioStr);
    const mes = parseInt(mesStr);

    const diasHabiles = obtenerDiasHabilesMes(anio, mes);
    const filas = diasHabiles.map(dia => mapa[dia] || {
      dia,
      entrada: '',
      salida: '',
      horas: ''
    });

    render(filas);
  } catch (e) {
    alert(e.message);
    console.error('Error:', e);
  }
});

// Precargar fechas: primer y último día del mes actual
document.addEventListener('DOMContentLoaded', () => {
  const fiInput = document.getElementById('fi');
  const ffInput = document.getElementById('ff');

  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  const formato = fecha => fecha.toISOString().split('T')[0];

  fiInput.value = formato(primerDia);
  ffInput.value = formato(ultimoDia);

  const inputGafete = document.getElementById('emp');
  const gafete = window.usuario.obtenerGafete();

  if (gafete) {
    inputGafete.value = gafete;
    inputGafete.readOnly = true;
    inputGafete.classList.add('bg-gray-200', 'text-gray-800');
  } else {
    inputGafete.placeholder = 'Usuario no registrado';
    inputGafete.classList.add('border', 'border-red-500');
  }
});
