/* --------------------------------------------------------------------- *
 *  renderer.js – asistencia + permisos y exportación PDF                *
 * --------------------------------------------------------------------- */

/* ========== 0. Referencias de elementos ============================== */
const circle     = document.getElementById('circle');
const statusSpan = document.getElementById('status');
const btnExport  = document.getElementById('btnExport');
const btnConsultar  = document.getElementById('btnConsultar');
let currentPdfUrl = null;

function setExportEnabled(enabled) {
  if (enabled) {
    btnExport.removeAttribute('disabled');
    btnExport.classList.remove('opacity-40', 'cursor-not-allowed');
  } else {
    btnExport.setAttribute('disabled', 'true');
    btnExport.classList.add('opacity-40', 'cursor-not-allowed');
  }
}
setExportEnabled(false);

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

    let entradaFinal = f.entrada;
    let salidaFinal  = f.salida;

    let claseEnt = 'text-gray-400 italic';
    let claseSal = 'text-gray-400 italic';
    let claseHoras = 'text-gray-400 italic';

    const esPermiso = !!f.permiso;
    const sinMarcacion = !f.entrada && !f.salida && !esPermiso;

    // Comparar si hay permiso y determinar qué hora prevalece
    if (esPermiso) {
      const entPermiso = f.permiso.ini;
      const salPermiso = f.permiso.fin;

      if (f.entrada) {
        entradaFinal = entPermiso < f.entrada ? entPermiso : f.entrada;
        claseEnt = entradaFinal === entPermiso ? 'text-blue-600 font-semibold' : 'text-gray-800';
      } else {
        entradaFinal = entPermiso;
        claseEnt = 'text-blue-600 font-semibold';
      }

      if (f.salida) {
        salidaFinal = salPermiso > f.salida ? salPermiso : f.salida;
        claseSal = salidaFinal === salPermiso ? 'text-blue-600 font-semibold' : 'text-gray-800';
      } else {
        salidaFinal = salPermiso;
        claseSal = 'text-blue-600 font-semibold';
      }

      claseHoras = 'text-gray-800 font-bold';

    } else if (!sinMarcacion) {
      const [hE, mE] = (entradaFinal || '00:00').split(':').map(Number);
      const [hS, mS] = (salidaFinal  || '00:00').split(':').map(Number);
      const tarde = hE > 8 || (hE === 8 && mE > 0);
      const pronto = hS < 15 || (hS === 15 && mS < 30);
      claseEnt = tarde ? 'text-red-600 font-semibold' : 'text-gray-800';
      claseSal = pronto ? 'text-red-600 font-semibold' : 'text-gray-800';
      claseHoras = 'text-gray-800 font-bold';
    }

    const tooltipPermiso = esPermiso
      ? `${f.permiso.ini} – ${f.permiso.fin}\n${f.permiso.cat}\n${f.permiso.reason}`
      : '';

    const horasHtml = f.horas
      ? `${f.horas} h ${esPermiso
          ? `<span class="ml-1 text-blue-500 cursor-help" title="${tooltipPermiso.replace(/\n/g, '&#10;')}">ℹ︎</span>`
          : ''}`
      : '--';

    tr.innerHTML = `
      <td class="border p-3 text-sm text-gray-800 font-medium">${f.dia}</td>
      <td class="border p-3 text-sm ${claseEnt} text-center">${entradaFinal || '-- sin marcación --'}</td>
      <td class="border p-3 text-sm ${claseSal} text-center">${salidaFinal  || '-- sin marcación --'}</td>
      <td class="border p-3 text-sm text-right ${claseHoras}">${horasHtml}</td>
    `;

    tbody.appendChild(tr);
  });

  window.__filasTabla = filas;
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

function calcularHoras(ini, fin) {
  const [h1, m1] = ini.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  return (minutos > 0 ? (minutos / 60).toFixed(1) : '0.0');
}

/* ---------- 4. Botón “Consultar” ------------------------------------- */
btnConsultar.addEventListener('click', async () => {
  const empCode = String(window.__empCode ?? '').trim();
  const fi = document.getElementById('fi').value;
  const ff = document.getElementById('ff').value;

  if (!empCode || !fi || !ff) {
    alert('Complete todos los campos');
    return;
  }

  setExportEnabled(false);

  try {
    // 1) Obtener datos del empleado y asistencias
    const empleado = await window.api.obtenerEmpleadoDesdePersonnel(empCode);
    const reporte  = await window.api.obtenerReporteAsistencia(empleado.id, fi, ff);

    // 2) Mapear asistencia diaria
    const mapa = Object.fromEntries(
      reporte.map(r => {
        const [dd, mm, yyyy] = r.att_date.split('-');
        const fechaKey = `${dd}/${mm}/${yyyy}`;
        return [fechaKey, {
          dia     : fechaKey,
          entrada : r.first_punch || '',
          salida  : r.last_punch  || '',
          horas   : r.total_time?.toFixed(1) || '',
        }];
      })
    );

    // 3) Integrar permisos y recalcular entrada/salida/horas
    const permisos = await window.api.obtenerPermisos(empCode, fi, ff);
    permisos.forEach(p => {
      const [startDate, startTime] = p.start_time.split(' ');
      const [endDate,   endTime]   = p.end_time.split(' ');
      const [yyyy, mm, dd]         = startDate.split('-');
      const fechaKey = `${dd}/${mm}/${yyyy}`;

      const permisoIni = startTime.slice(0,5);
      const permisoFin = endTime.slice(0,5);
      const existente = mapa[fechaKey] ?? { entrada:'', salida:'', horas:'' };

      const entradaFinal = (existente.entrada && existente.entrada < permisoIni)
        ? existente.entrada
        : permisoIni;
      const salidaFinal = (existente.salida && existente.salida > permisoFin)
        ? existente.salida
        : permisoFin;

      const horasCalculadas = (entradaFinal && salidaFinal)
        ? calcularHoras(entradaFinal, salidaFinal)
        : '';

      mapa[fechaKey] = {
        dia     : fechaKey,
        entrada : entradaFinal,
        salida  : salidaFinal,
        horas   : horasCalculadas,
        permiso : {
          ini   : permisoIni,
          fin   : permisoFin,
          cat   : p.category,
          reason: p.apply_reason.trim()
        }
      };
    });

    // 4) Generar lista de días hábiles del mes
    const [anio, mes] = fi.split('-').map(Number);
    let filas = obtenerDiasHabilesMes(anio, mes).map(d =>
      mapa[d] || { dia: d, entrada:'', salida:'', horas:'' }
    );

    // 5) VALIDACIÓN: si salida === entrada, borrar solo salida y horas
    filas = filas.map(f => {
      if (f.salida && f.entrada === f.salida) {
        return { ...f, salida: '', horas: '' };
      }
      return f;
    });

    // 6) Renderizar y habilitar exportación
    render(filas);
    setExportEnabled(true);

    // 7) Guardar estado para exportar
    window.__filasTabla  = filas;
    window.__empCode     = empCode;
    window.__empNombre   = window.catalogo?.porGafete(empCode)?.nombre || '';
    window.__startDate   = fi;
    window.__endDate     = ff;

    // 8) Cálculo y despliegue de “Tiempo Tardío” en UI
    const minutosAutorizados = 30;
    let minutosTardiosDetectados = 0;
    let diasSinMarcaje = 0;
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    filas.forEach(f => {
      const [dd, mm, yyyy] = f.dia.split('/');
      const fechaDia = new Date(Number(yyyy), Number(mm)-1, Number(dd));
      fechaDia.setHours(0,0,0,0);
      if (fechaDia >= hoy) return;

      const tieneEntrada = !!f.entrada;
      const tieneSalida  = !!f.salida;
      if (!tieneEntrada && !tieneSalida) {
        diasSinMarcaje++;
        minutosTardiosDetectados += 450;
        return;
      }
      if (tieneEntrada) {
        const [hE, mE] = f.entrada.split(':').map(Number);
        if (hE > 8 || (hE===8 && mE>0))
          minutosTardiosDetectados += (hE-8)*60 + mE;
      }
      if (tieneSalida) {
        if (!tieneEntrada || f.salida>f.entrada) {
          const [hS, mS] = f.salida.split(':').map(Number);
          if (hS < 15 || (hS===15 && mS<30))
            minutosTardiosDetectados += (15-hS)*60 + (30-mS);
        }
      }
    });

    const minutosNetos = Math.max(minutosTardiosDetectados - minutosAutorizados, 0);
    const tardiosDiv = document.getElementById('tardios');
    tardiosDiv.innerHTML = `
      <div class="p-4 bg-yellow-100 border border-yellow-400 rounded text-sm text-yellow-800">
        <p class="font-bold mb-2">Tiempo Tardío</p>
        <div class="grid grid-cols-2 gap-x-8">
          <p>Minutos autorizados: <strong>${minutosAutorizados}</strong></p>
          <p>Minutos netos:       <strong>${minutosNetos}</strong></p>
          <p>Minutos detectados:  <strong>${minutosTardiosDetectados}</strong></p>
          <p>Días sin marcaje:     <strong>${diasSinMarcaje}</strong></p>
        </div>
      </div>
    `;
  }
  catch (err) {
    alert(err.message);
    console.error('Error:', err);
    setExportEnabled(false);
  }
});



/* ---------- 5. Precargar fechas y gafete ----------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const fi = document.getElementById('fi');
  const ff = document.getElementById('ff');
  const hoy = new Date();
  fi.value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  ff.value = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

  const wrapper       = document.getElementById('gafete-wrapper');
  const btnConsultar  = document.getElementById('btnConsultar');
  const poolInfo      = window.usuario.obtenerPoolInfo();
  const miInfo        = window.usuario.obtenerMiInfo();

  // Limpia el wrapper
  wrapper.innerHTML = '';

  // Creamos siempre un <select>
  const sel = document.createElement('select');
  sel.id        = 'empSelect';
  sel.className = 'border rounded px-3 py-2 bg-white w-full';

  if (poolInfo && poolInfo.length > 0) {
    // ——— Usuario del pool: opción por defecto + listado del pool ———
    const opt = new Option('Seleccione un empleado', '');
    opt.disabled = true;
    opt.selected = true;
    sel.appendChild(opt);

    // Ordenar alfabéticamente por nombre antes de construir el <select>
    poolInfo
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
      .forEach(info => {
        const label = `${info.nombre} (${info.gafete}) — ${info.usuario}`;
        sel.appendChild(new Option(label, info.gafete));
      });

    sel.addEventListener('change', () => {
      window.__empCode   = sel.value;
      window.__empNombre = sel.options[sel.selectedIndex].text.split(' (')[0];
      btnConsultar.disabled = false;
      btnConsultar.classList.remove('opacity-40', 'cursor-not-allowed');

      // Limpia la tabla
      document.getElementById('tbody').innerHTML = '';
      document.getElementById('tardios').innerHTML = '';
      setExportEnabled(false);
    });

    btnConsultar.disabled = true;
    btnConsultar.classList.add('opacity-40', 'cursor-not-allowed');

  } else if (miInfo) {
    // ——— Usuario normal: solo una opción, select deshabilitado ———
    const label = `${miInfo.nombre} (${miInfo.gafete}) — ${miInfo.usuario}`;
    sel.appendChild(new Option(label, miInfo.gafete));
    sel.disabled = true;

    // Preseleccionamos sus datos globales
    window.__empCode   = miInfo.gafete;
    window.__empNombre = miInfo.nombre;

    btnConsultar.disabled = false;
    btnConsultar.classList.remove('opacity-40', 'cursor-not-allowed');
  } else {
    // ——— Usuario no registrado ———
    const opt = new Option('Usuario no registrado', '');
    opt.disabled = true;
    opt.selected = true;
    sel.appendChild(opt);
    sel.disabled = true;

    btnConsultar.disabled = true;
    btnConsultar.classList.add('opacity-40', 'cursor-not-allowed');
  }

  wrapper.appendChild(sel);
});



/* ---------- 6. Botón “Exportar” -------------------------------------- */
btnExport.addEventListener('click', () => {
  const filas = window.__filasTabla;
  if (!filas?.length) return;

  const gafete    = window.__empCode   ?? '';
  const nombre    = window.__empNombre ?? '';
  const fechaIni  = (window.__startDate ?? '').split('-').reverse().join('/');
  const fechaFin  = (window.__endDate   ?? '').split('-').reverse().join('/');
  const exportado = new Date().toLocaleString('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Cálculo: Tiempo Tardío (para PDF)
  const minutosAutorizados = 30;
  let minutosTardiosDetectados = 0;
  let diasSinMarcaje = 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  filas.forEach(f => {
    const [dd, mm, yyyy] = f.dia.split('/');
    const fechaDia = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    fechaDia.setHours(0, 0, 0, 0);
    if (fechaDia >= hoy) return;

    const tieneEntrada = !!f.entrada;
    const tieneSalida  = !!f.salida;

    if (!tieneEntrada && !tieneSalida) {
      diasSinMarcaje++;
      minutosTardiosDetectados += 450;
      return;
    }

    if (tieneEntrada) {
      const [hE, mE] = f.entrada.split(':').map(Number);
      if (hE > 8 || (hE === 8 && mE > 0)) {
        minutosTardiosDetectados += (hE - 8) * 60 + mE;
      }
    }

    if (tieneSalida) {
      if (!tieneEntrada || f.salida > f.entrada) {
        const [hS, mS] = f.salida.split(':').map(Number);
        if (hS < 15 || (hS === 15 && mS < 30)) {
          minutosTardiosDetectados += (15 - hS) * 60 + (30 - mS);
        }
      }
    }
  });

  const minutosNetos = Math.max(minutosTardiosDetectados - minutosAutorizados, 0);

  // Cuerpo de tabla de asistencia
  const body = [
    [
      { text: 'Fecha',           style: 'th' },
      { text: 'Entrada',         style: 'th' },
      { text: 'Salida',          style: 'th' },
      { text: 'Horas / Permiso', style: 'th' }
    ],
    ...filas.map(f => {
      const permiso = f.permiso;
      const esPermiso = !!permiso;
      const [hE = 0, mE = 0] = (f.entrada || '').split(':').map(Number);
      const [hS = 0, mS = 0] = (f.salida  || '').split(':').map(Number);
      const entradaTarde = !esPermiso && (hE > 8 || (hE === 8 && mE > 0));
      const salidaPronto = !esPermiso && (hS < 15 || (hS === 15 && mS < 30));

      // Colores para entrada y salida
      const entradaColor = permiso && f.entrada === permiso.ini
        ? 'blue'
        : (entradaTarde ? 'red' : undefined);
      const salidaColor  = permiso && f.salida === permiso.fin
        ? 'blue'
        : (salidaPronto ? 'red' : undefined);

      // Celda Horas / Permiso: rango azul + horas negras
      let horasPermisoCell;
      if (esPermiso) {
        const parts = [
          { text: `${permiso.ini} – ${permiso.fin}`, color: 'blue' }
        ];
        if (f.horas) {
          parts.push({ text: ` ${f.horas}h` });
        }
        horasPermisoCell = { text: parts, style: 'td' };
      } else {
        horasPermisoCell = { text: f.horas || '', style: 'td' };
      }

      return [
        { text: f.dia,            style: 'td' },
        { text: f.entrada || '—', style: 'td', color: entradaColor },
        { text: f.salida  || '—', style: 'td', color: salidaColor },
        horasPermisoCell
      ];
    })
  ];

  // Definición y apertura del PDF
  const docDefinition = {
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `reporte_${gafete}_${fechaIni.replace(/\//g, '-')}_${fechaFin.replace(/\//g, '-')}`
    },
    content: [
      { text: 'REPORTE DE ASISTENCIA', style: 'titulo' },
      { text: `Gafete: ${gafete}`,         margin: [0, 0, 0, 2] },
      { text: `Nombre: ${nombre}`,         margin: [0, 0, 0, 2] },
      { text: `Rango de fechas: ${fechaIni} – ${fechaFin}`, margin: [0, 0, 0, 2] },
      { text: `Exportado el: ${exportado}`, margin: [0, 0, 0, 18], style: 'nota' },

      { text: 'Tiempo Tardío', style: 'subtitulo', margin: [0, 0, 0, 6] },
      {
        margin: [0, 0, 0, 18],
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: 'Minutos autorizados: ' + minutosAutorizados, style: 'td' },
              { text: 'Minutos netos: '       + minutosNetos,       style: 'td' }
            ],
            [
              { text: 'Minutos detectados: ' + minutosTardiosDetectados, style: 'td' },
              { text: 'Días sin marcaje: '   + diasSinMarcaje,            style: 'td' }
            ]
          ]
        },
        layout: {
          hLineWidth:  () => 0,
          vLineWidth:  () => 0,
          paddingTop:    () => 2,
          paddingBottom: () => 2,
          fillColor:     () => '#FEF3C7'
        }
      },

      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: { headerRows: 1, widths: [70, 60, 60, 90], body },
            layout: {
              fillColor:  row => row === 0 ? '#E5E7EB' : null,
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#BDBDBD',
              vLineColor: () => '#BDBDBD'
            }
          },
          { width: '*', text: '' }
        ]
      }
    ],
    styles: {
      titulo:    { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 12] },
      subtitulo: { fontSize: 12, bold: true, margin: [0, 2, 0, 6] },
      nota:      { fontSize: 8,  color: '#555' },
      th:        { fontSize: 9,  bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      td:        { fontSize: 8,  alignment: 'center', margin: [0, 2, 0, 2] }
    }
  };

  window.pdfMake.createPdf(docDefinition).open();
});



