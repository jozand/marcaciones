/* --------------------------------------------------------------------- *
 *  renderer.js – muestra asistencia y permisos BioTime                  *
 * --------------------------------------------------------------------- */

/* ---------- 1. Indicador de conexión JWT ----------------------------- */
const circle     = document.getElementById('circle');
const statusSpan = document.getElementById('status');

window.api.ensureToken()
  .then(() => {
    circle.className = 'w-4 h-4 rounded-full bg-green-500';
    statusSpan.textContent = 'Conectado';
    statusSpan.className   = 'text-sm text-green-600';
  })
  .catch(err => {
    circle.className = 'w-4 h-4 rounded-full bg-red-500';
    statusSpan.textContent = `Error: ${err.message}`;
    statusSpan.className   = 'text-sm text-red-600';
    console.error('Error de conexión', err);
  });

/* ---------- 2. Función de renderizado -------------------------------- */
function render(filas) {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';

  filas.forEach((f, idx) => {
    const tr = document.createElement('tr');
    tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

    const esPermiso   = !!f.permiso;
    const sinMarcacion = !f.entrada && !f.salida && !esPermiso;

    /* Colores iniciales */
    let claseEnt  = 'text-gray-400 italic';
    let claseSal  = 'text-gray-400 italic';
    let claseHoras= sinMarcacion ? 'text-gray-400 italic'
                                 : 'text-gray-800 font-bold';

    /* — Permiso → azul — */
    if (esPermiso) {
      claseEnt = claseSal = 'text-blue-600 font-semibold';
      claseHoras         = 'text-blue-600 font-semibold';
    }
    /* — Llegada tarde / salida temprano — */
    else if (!sinMarcacion) {
      const [hE, mE] = f.entrada.split(':').map(Number);
      const [hS, mS] = f.salida .split(':').map(Number);
      const tarde  = hE > 8 || (hE === 8 && mE > 0);
      const pronto = hS < 15 || (hS === 15 && mS < 30);
      claseEnt = tarde  ? 'text-red-600 font-semibold' : 'text-gray-800';
      claseSal = pronto ? 'text-red-600 font-semibold' : 'text-gray-800';
    }

    /* Contenido columna Horas */
    const horasHtml = esPermiso
      ? `${f.permiso.ini}-${f.permiso.fin}
         <span class="ml-1 text-blue-500 cursor-help"
               title="${f.permiso.cat} – ${f.permiso.reason}">
           ℹ︎
         </span>`
      : (f.horas || '0.0 h');

    tr.innerHTML = `
      <td class="border p-3 text-sm text-gray-800 font-medium">${f.dia}</td>
      <td class="border p-3 text-sm ${claseEnt} text-center">
          ${f.entrada || (esPermiso ? '—' : '-- sin marcación --')}
      </td>
      <td class="border p-3 text-sm ${claseSal} text-center">
          ${f.salida  || (esPermiso ? '—' : '-- sin marcación --')}
      </td>
      <td class="border p-3 text-sm text-right ${claseHoras}">
          ${horasHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- 3. Utilidades de fechas ---------------------------------- */
function obtenerDiasHabilesMes(anio, mes) {
  const dias = [];
  const fecha = new Date(anio, mes - 1, 1);
  while (fecha.getMonth() === mes - 1) {
    const dSem = fecha.getDay();
    if (dSem >= 1 && dSem <= 5) {                     // lunes-viernes
      const dd = String(fecha.getDate()).padStart(2, '0');
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
      const yyyy = fecha.getFullYear();
      dias.push(`${dd}/${mm}/${yyyy}`);
    }
    fecha.setDate(fecha.getDate() + 1);
  }
  return dias;
}

/* ---------- 4. Botón “Consultar” ------------------------------------- */
document.getElementById('btn').addEventListener('click', async () => {
  const empCode = document.getElementById('emp').value.trim();
  const fi = document.getElementById('fi').value;
  const ff = document.getElementById('ff').value;

  if (!empCode || !fi || !ff) {
    alert('Complete todos los campos');
    return;
  }

  try {
    /* --- A) Datos de asistencia -------------------------------------- */
    const empleado = await window.api.obtenerEmpleadoDesdePersonnel(empCode);
    const reporte  = await window.api.obtenerReporteAsistencia(empleado.id, fi, ff);

    /* mapa[fecha] = { entrada, salida, horas } */
    const mapa = Object.fromEntries(
      reporte.map(d => {
        const [dd, mm, yyyy] = d.att_date.split('-');
        const fechaKey = `${dd.padStart(2,'0')}/${mm.padStart(2,'0')}/${yyyy}`;
        return [ fechaKey, {
          dia    : fechaKey,
          entrada: d.first_punch || '',
          salida : d.last_punch  || '',
          horas  : d.total_time?.toFixed(1) || ''
        }];
      })
    );

    /* --- B) Permisos -------------------------------------------------- */
    const permisos = await window.api.obtenerPermisos(empCode, fi, ff);

    /* convertir a mapa fecha → info permiso */
    const permisosMapa = {};
    permisos.forEach(p => {
      const [startDate, startTime] = p.start_time.split(' ');
      const [endDate,   endTime  ] = p.end_time  .split(' ');

      /* Tomamos solo la fecha de inicio; extender si manejas rangos */
      const [yyyy, mm, dd] = startDate.split('-');
      const fechaKey = `${dd}/${mm}/${yyyy}`;

      permisosMapa[fechaKey] = {
        ini   : startTime.slice(0,5),
        fin   : endTime.slice(0,5),
        cat   : p.category,
        reason: p.apply_reason.trim()
      };
    });

    /* fusionar permisos en mapa de asistencia ------------------------- */
    Object.entries(permisosMapa).forEach(([fecha, info]) => {
      mapa[fecha] = {
        dia     : fecha,
        entrada : info.ini,
        salida  : info.fin,
        horas   : '',
        permiso : info
      };
    });

    /* --- C) Completar días hábiles ----------------------------------- */
    const [anio, mes] = fi.split('-').map(Number);        // YYYY-MM-DD
    const diasHabiles = obtenerDiasHabilesMes(anio, mes);
    const filas = diasHabiles.map(dia => mapa[dia] || {
      dia, entrada:'', salida:'', horas:''
    });

    render(filas);
  } catch (err) {
    alert(err.message);
    console.error('Error:', err);
  }
});

/* ---------- 5. Precargar campos fecha y gafete ------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  const fiInput = document.getElementById('fi');
  const ffInput = document.getElementById('ff');

  const hoy = new Date();
  const primerDia  = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDia  = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0);
  const iso = f => f.toISOString().split('T')[0];

  fiInput.value = iso(primerDia);
  ffInput.value = iso(ultimoDia);

  const inputGafete = document.getElementById('emp');
  const gafete = window.usuario.obtenerGafete();
  if (gafete) {
    inputGafete.value = gafete;
    inputGafete.readOnly = true;
    inputGafete.classList.add('bg-gray-200','text-gray-800');
  } else {
    inputGafete.placeholder = 'Usuario no registrado';
    inputGafete.classList.add('border','border-red-500');
  }
});
