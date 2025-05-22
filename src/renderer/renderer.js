/* --------------------------------------------------------------------- *
 *  renderer.js – asistencia + permisos y exportación PDF                *
 * --------------------------------------------------------------------- */

/* ========== 0. Referencias de elementos ============================== */
const circle     = document.getElementById('circle');
const statusSpan = document.getElementById('status');
const btnExport  = document.getElementById('btnExport');

/* Helper para habilitar / deshabilitar el botón Exportar */
function setExportEnabled(enabled) {
  if (enabled) {
    btnExport.removeAttribute('disabled');
    btnExport.classList.remove('opacity-40', 'cursor-not-allowed');
  } else {
    btnExport.setAttribute('disabled', 'true');
    btnExport.classList.add('opacity-40', 'cursor-not-allowed');
  }
}
setExportEnabled(false);                      // deshabilitado al cargar

/* ---------- 1. Indicador de conexión JWT ----------------------------- */
window.api.ensureToken()
  .then(() => {
    circle.className  = 'w-4 h-4 rounded-full bg-green-500';
    statusSpan.textContent = 'Conectado';
    statusSpan.className   = 'text-sm text-green-600';
  })
  .catch(err => {
    circle.className  = 'w-4 h-4 rounded-full bg-red-500';
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

    const esPermiso    = !!f.permiso;
    const sinMarcacion = !f.entrada && !f.salida && !esPermiso;

    /* Colores iniciales */
    let claseEnt  = 'text-gray-400 italic';
    let claseSal  = 'text-gray-400 italic';
    let claseHoras= sinMarcacion ? 'text-gray-400 italic'
                                 : 'text-gray-800 font-bold';

    if (esPermiso) {                                    // Permiso → azul
      claseEnt = claseSal = 'text-blue-600 font-semibold';
      claseHoras        = 'text-blue-600 font-semibold';
    } else if (!sinMarcacion) {                         // Tarde / temprano
      const [hE, mE] = (f.entrada || '00:00').split(':').map(Number);
      const [hS, mS] = (f.salida  || '00:00').split(':').map(Number);
      const tarde  = hE > 8 || (hE === 8 && mE > 0);
      const pronto = hS < 15 || (hS === 15 && mS < 30);
      claseEnt = tarde  ? 'text-red-600 font-semibold' : 'text-gray-800';
      claseSal = pronto ? 'text-red-600 font-semibold' : 'text-gray-800';
    }

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

  window.__filasTabla = filas;               // usado por exportar
}

/* ---------- 3. Utilidades de fechas ---------------------------------- */
function obtenerDiasHabilesMes(anio, mes) {
  const dias = [];
  const fecha = new Date(anio, mes - 1, 1);
  while (fecha.getMonth() === mes - 1) {
    const d = fecha.getDay();
    if (d >= 1 && d <= 5) {
      const dd = String(fecha.getDate()).padStart(2, '0');
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
      dias.push(`${dd}/${mm}/${fecha.getFullYear()}`);
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

  setExportEnabled(false);                    // desactiva mientras carga

  try {
    /* A) Asistencia --------------------------------------------------- */
    const empleado = await window.api.obtenerEmpleadoDesdePersonnel(empCode);
    const reporte  = await window.api.obtenerReporteAsistencia(empleado.id, fi, ff);

    const mapa = Object.fromEntries(
      reporte.map(r => {
        const [dd, mm, yyyy] = r.att_date.split('-');
        const fechaKey = `${dd.padStart(2,'0')}/${mm.padStart(2,'0')}/${yyyy}`;
        return [fechaKey, {
          dia    : fechaKey,
          entrada: r.first_punch || '',
          salida : r.last_punch  || '',
          horas  : r.total_time?.toFixed(1) || ''
        }];
      })
    );

    /* B) Permisos ----------------------------------------------------- */
    const permisos = await window.api.obtenerPermisos(empCode, fi, ff);
    permisos.forEach(p => {
      const [startDate, startTime] = p.start_time.split(' ');
      const [endDate,   endTime  ] = p.end_time.split(' ');
      const [yyyy, mm, dd] = startDate.split('-');
      const fechaKey = `${dd}/${mm}/${yyyy}`;
      mapa[fechaKey] = {
        dia     : fechaKey,
        entrada : startTime.slice(0,5),
        salida  : endTime.slice(0,5),
        horas   : '',
        permiso : {
          ini   : startTime.slice(0,5),
          fin   : endTime.slice(0,5),
          cat   : p.category,
          reason: p.apply_reason.trim()
        }
      };
    });

    /* C) Completar días hábiles -------------------------------------- */
    const [anio, mes] = fi.split('-').map(Number);
    const filas = obtenerDiasHabilesMes(anio, mes).map(d =>
      mapa[d] || { dia:d, entrada:'', salida:'', horas:'' }
    );

    render(filas);
    setExportEnabled(true);                 // habilita exportar

    /* D) Variables para el PDF --------------------------------------- */
    window.__empCode   = empCode;
    window.__empNombre = window.catalogo?.porGafete(empCode)?.nombre || '';
    window.__startDate = fi;
    window.__endDate   = ff;

  } catch (err) {
    alert(err.message);
    console.error('Error:', err);
    setExportEnabled(false);
  }
});

/* ---------- 5. Precargar fechas y gafete ----------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const fiInput = document.getElementById('fi');
  const ffInput = document.getElementById('ff');
  const hoy = new Date();
  fiInput.value = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
                    .toISOString().split('T')[0];
  ffInput.value = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0)
                    .toISOString().split('T')[0];

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

/* ---------- 6. Botón “Exportar” -------------------------------------- */
btnExport.addEventListener('click', () => {
  const filas = window.__filasTabla;
  if (!filas?.length) return;

  const gafete    = window.__empCode   ?? '';
  const nombre    = window.__empNombre ?? '';
  const fechaIni  = window.__startDate ?? '';
  const fechaFin  = window.__endDate   ?? '';
  const exportado = new Date().toLocaleString('es-GT');

  const body = [
    ['Fecha', 'Entrada', 'Salida', 'Horas/Permiso'],
    ...filas.map(f => [
      f.dia,
      f.entrada || '',
      f.salida  || '',
      f.permiso ? `${f.permiso.ini} – ${f.permiso.fin}` : (f.horas || '')
    ])
  ];

  const docDefinition = {
    pageMargins: [40, 60, 40, 60],
    content: [
      { text: 'REPORTE DE ASISTENCIA', style: 'titulo' },
      { text: `Gafete: ${gafete}`,  margin: [0,0,0,2] },
      { text: `Nombre: ${nombre}`, margin: [0,0,0,2] },
      { text: `Rango de fechas: ${fechaIni} – ${fechaFin}`, margin: [0,0,0,2] },
      { text: `Exportado el: ${exportado}`, margin: [0,0,0,10], fontSize: 9, color: '#555' },
      {
        style: 'tabla',
        table: { headerRows: 1, widths: ['*', 60, 60, 80], body },
        layout: 'lightHorizontalLines'
      }
    ],
    styles: {
      titulo: { fontSize: 14, bold: true, alignment: 'center', margin: [0,0,0,10] },
      tabla:  { fontSize: 9 }
    }
  };

  window.pdfMake
  .createPdf(docDefinition)
  .open();   // ← abre el PDF en una pestaña / ventana nueva

});
