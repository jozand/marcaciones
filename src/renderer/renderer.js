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

  // Recuperamos flag de horario especial
  const especial = window.__especial === true;
  const [corteEntH, corteEntM] = especial ? [7, 0] : [8, 0];
  const [corteSalH, corteSalM] = especial ? [14, 30] : [15, 30];

  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  filas.forEach((f, idx) => {
    const tr = document.createElement('tr');
    tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

    // Fecha de la fila
    const [dd, mm, yyyy] = f.dia.split('/');
    const fechaDia = new Date(+yyyy, +mm - 1, +dd);
    fechaDia.setHours(0,0,0,0);

    let entradaFinal = f.entrada;
    let salidaFinal  = f.salida;
    let claseEnt     = 'text-gray-400 italic';
    let claseSal     = 'text-gray-400 italic';

    const esPermiso    = !!f.permiso;
    const permisoIni   = esPermiso ? f.permiso.ini : null;
    const permisoFin   = esPermiso ? f.permiso.fin : null;
    const sinMarcacion = !f.entrada && !f.salida && !esPermiso;

    // 1) Día futuro sin marcación → gris italic
    if (sinMarcacion && fechaDia > hoy) {
      // no cambios
    }
    // 2) Hoy o pasado sin marcación → rojo
    else if (sinMarcacion && fechaDia <= hoy) {
      claseEnt = claseSal = 'text-red-600 font-semibold';
    }
    // 3) Días con permiso: colorear cada celda según si el permiso cabe en su horario oficial
    else if (esPermiso) {
      // --- Entrada ---
      if (f.entrada) {
        entradaFinal = permisoIni < f.entrada ? permisoIni : f.entrada;
      } else {
        entradaFinal = permisoIni;
      }
      {
        const [hE, mE] = entradaFinal.split(':').map(Number);
        const vieneDelPermiso = entradaFinal === permisoIni;
        const dentroDeHorario = (hE < corteEntH) || (hE === corteEntH && mE <= corteEntM);
        if (vieneDelPermiso && dentroDeHorario) {
          claseEnt = 'text-blue-600 font-semibold';
        } else {
          const esTarde = hE > corteEntH || (hE === corteEntH && mE > corteEntM);
          claseEnt = esTarde
            ? 'text-red-600 font-semibold'
            : 'text-gray-800';
        }
      }

      // --- Salida ---
      if (f.salida) {
        salidaFinal = permisoFin > f.salida ? permisoFin : f.salida;
      } else {
        salidaFinal = permisoFin;
      }
      {
        const [hS, mS] = salidaFinal.split(':').map(Number);
        const vieneDelPermiso = salidaFinal === permisoFin;
        const dentroDeHorario = (hS > corteSalH) || (hS === corteSalH && mS >= corteSalM);
        if (vieneDelPermiso && dentroDeHorario) {
          claseSal = 'text-blue-600 font-semibold';
        } else {
          const esPronto = hS < corteSalH || (hS === corteSalH && mS < corteSalM);
          claseSal = esPronto
            ? 'text-red-600 font-semibold'
            : 'text-gray-800';
        }
      }
    }
    // 4) Días normales sin permiso: negro o rojo según tarde/pronto
    else {
      // Entrada
      if (f.entrada) {
        const [hE, mE] = f.entrada.split(':').map(Number);
        const esTarde = hE > corteEntH || (hE === corteEntH && mE > corteEntM);
        claseEnt = esTarde ? 'text-red-600 font-semibold' : 'text-gray-800';
      } else {
        claseEnt = fechaDia <= hoy
          ? 'text-red-600 font-semibold'
          : 'text-gray-400 italic';
      }

      // Salida
      if (f.salida) {
        const [hS, mS] = f.salida.split(':').map(Number);
        const esPronto = hS < corteSalH || (hS === corteSalH && mS < corteSalM);
        claseSal = esPronto ? 'text-red-600 font-semibold' : 'text-gray-800';
      } else {
        claseSal = fechaDia <= hoy
          ? 'text-red-600 font-semibold'
          : 'text-gray-400 italic';
      }
    }

    // Construir celda Permiso (solo horario con tooltip)
    let permisoHtml = '';
    if (esPermiso) {
      const tooltip =
        `${f.permiso.ini} – ${f.permiso.fin}\n` +
        `${f.permiso.cat}\n` +
        `${f.permiso.reason.trim()}`;
      permisoHtml = `
        <span class="text-blue-600 cursor-help" title="${tooltip.replace(/\n/g,'&#10;')}">
          ${f.permiso.ini} – ${f.permiso.fin}
        </span>`;
    }

    tr.innerHTML = `
      <td class="border p-3 text-sm text-gray-800 font-medium">${f.dia}</td>
      <td class="border p-3 text-sm ${claseEnt} text-center">
        ${entradaFinal || '-- sin marcación --'}
      </td>
      <td class="border p-3 text-sm ${claseSal} text-center">
        ${salidaFinal  || '-- sin marcación --'}
      </td>
      <td class="border p-3 text-sm text-right">${permisoHtml}</td>
    `;

    tbody.appendChild(tr);
  });

  // Guardar para exportación
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
  const fi      = document.getElementById('fi').value;
  const ff      = document.getElementById('ff').value;

  if (!empCode || !fi || !ff) {
    alert('Complete todos los campos');
    return;
  }

  setExportEnabled(false);

  try {
    // 1) Datos del empleado y umbrales dinámicos
    const empleado = await window.api.obtenerEmpleadoDesdePersonnel(empCode);
    const especial = window.catalogo?.porGafete(empCode)?.horarioEspecial;
    const [corteEntH, corteEntM] = especial ? [7, 0] : [8, 0];
    const [corteSalH, corteSalM] = especial ? [14, 30] : [15, 30];

    // Guardamos los umbrales para el exportador
    window.__especial   = especial;
    window.__corteEnt   = [corteEntH, corteEntM];
    window.__corteSal   = [corteSalH, corteSalM];

    // 2) Obtener reporte y mapear por fecha, asignando entrada/salida
    const reporte = await window.api.obtenerReporteAsistencia(empleado.id, fi, ff);
    const mapa = Object.fromEntries(
      reporte.map(r => {
        const [dd, mm, yyyy] = r.att_date.split('-');
        const key = `${dd}/${mm}/${yyyy}`;

        const fp = r.first_punch || '';
        const lp = r.last_punch  || '';
        let entrada = '', salida = '';

        if (fp && lp && fp !== lp) {
          // Dos marcas distintas → primera = entrada, segunda = salida
          entrada = fp;
          salida  = lp;
        } else {
          // Una sola marca (o idénticas) → decidir por antes/después de mediodía
          const sola = fp || lp;
          if (sola) {
            const [h] = sola.split(':').map(Number);
            if (h < 12) entrada = sola;
            else         salida  = sola;
          }
        }

        return [key, { dia:key, entrada, salida, horas:'' }];
      })
    );

    // 3) Integrar permisos multi-día
    const permisos = await window.api.obtenerPermisos(empCode, fi, ff);
    console.log(permisos);
    
    permisos.forEach(p => {
      const [startDateStr, startTime] = p.start_time.split(' ');
      const [endDateStr,   endTime]   = p.end_time.split(' ');
      const permisoIni = startTime.slice(0,5);
      const permisoFin = endTime.slice(0,5);

      let current = new Date(`${startDateStr}T00:00:00`);
      const endDate = new Date(`${endDateStr}T00:00:00`);
      while (current <= endDate) {
        const dd   = String(current.getDate()).padStart(2,'0');
        const mm   = String(current.getMonth()+1).padStart(2,'0');
        const yyyy = current.getFullYear();
        const key  = `${dd}/${mm}/${yyyy}`;

        const ex = mapa[key] || { entrada:'', salida:'', horas:'' };
        const entradaFinal = ex.entrada && ex.entrada < permisoIni ? ex.entrada : permisoIni;
        const salidaFinal  = ex.salida  && ex.salida  > permisoFin ? ex.salida  : permisoFin;
        const horasCalc    = (entradaFinal && salidaFinal)
                             ? calcularHoras(entradaFinal, salidaFinal)
                             : '';

        mapa[key] = {
          dia     : key,
          entrada : entradaFinal,
          salida  : salidaFinal,
          horas   : horasCalc,
          permiso : {
            ini   : permisoIni,
            fin   : permisoFin,
            cat   : p.category,
            reason: p.apply_reason.trim()
          }
        };

        current.setDate(current.getDate() + 1);
      }
    });

    // 4) Generar filas de días hábiles
    const [anio, mes] = fi.split('-').map(Number);
    let filas = obtenerDiasHabilesMes(anio, mes)
      .map(d => mapa[d] || { dia:d, entrada:'', salida:'', horas:'' });

    // 5) Borrar salida/horas donde entrada === salida
    filas = filas.map(f =>
      (f.salida && f.entrada === f.salida)
        ? { ...f, salida:'', horas:'' }
        : f
    );

    // 6) Renderizar y guardar estado principal
    render(filas);
    setExportEnabled(true);
    window.__filasTabla = filas;
    window.__empCode    = empCode;
    window.__startDate  = fi;
    window.__endDate    = ff;

    // 7) Cálculo de “Tiempo Tardío”
    const minutosAutorizados    = 30;
    let   minutosDetectados     = 0;
    let   diasSinMarcaje        = 0;
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    filas.forEach(f => {
      const [dd, mm, yyyy] = f.dia.split('/');
      const fechaDia = new Date(+yyyy, +mm-1, +dd);
      fechaDia.setHours(0,0,0,0);
      if (fechaDia >= hoy) return;

      const { entrada, salida } = f;
      const tieneE = !!entrada;
      const tieneS = !!salida;

      if (!tieneE && !tieneS) {
        diasSinMarcaje++;
        minutosDetectados += 450;
        return;
      }

      if (tieneE) {
        const [hE, mE] = entrada.split(':').map(Number);
        if (hE > corteEntH || (hE === corteEntH && mE > corteEntM)) {
          minutosDetectados += (hE - corteEntH)*60 + (mE - corteEntM);
        }
      }

      if (tieneS) {
        const [hS, mS] = salida.split(':').map(Number);
        if (hS < corteSalH || (hS === corteSalH && mS < corteSalM)) {
          minutosDetectados += (corteSalH - hS)*60 + (corteSalM - mS);
        }
      }
    });

    const minutosNetos = Math.max(minutosDetectados - minutosAutorizados, 0);

    // 8) Guardar resultados para btnExport
    window.__minutosAutorizados = minutosAutorizados;
    window.__minutosDetectados  = minutosDetectados;
    window.__minutosNetos       = minutosNetos;
    window.__diasSinMarcaje     = diasSinMarcaje;

    // 9) Actualizar UI de Tiempo Tardío
    document.getElementById('tardios').innerHTML = `
      <div class="p-4 bg-yellow-100 border border-yellow-400 rounded text-sm text-yellow-800">
        <p class="font-bold mb-2">Tiempo Tardío</p>
        <div class="grid grid-cols-2 gap-x-8">
          <p>Minutos autorizados: <strong>${minutosAutorizados}</strong></p>
          <p>Minutos netos:       <strong>${minutosNetos}</strong></p>
          <p>Minutos detectados:  <strong>${minutosDetectados}</strong></p>
          <p>Días sin marcaje:     <strong>${diasSinMarcaje}</strong></p>
        </div>
      </div>
    `;
  }
  catch (err) {
    alert(err.message);
    console.error(err);
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

  // 1) Datos de encabezado
  const gafete   = window.__empCode   || '';
  const nombre   = window.__empNombre || '';
  const fechaIni = (window.__startDate || '').split('-').reverse().join('/');
  const fechaFin = (window.__endDate   || '').split('-').reverse().join('/');
  const exportado = new Date().toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // 2) Variables precalculadas
  const minutosAutorizados = window.__minutosAutorizados;
  const minutosDetectados  = window.__minutosDetectados;
  const minutosNetos       = window.__minutosNetos;
  const diasSinMarcaje     = window.__diasSinMarcaje;
  const especial           = window.__especial === true;
  const [corteEntH, corteEntM] = window.__corteEnt;
  const [corteSalH, corteSalM] = window.__corteSal;

  // 3) ¿Hay algún permiso en las filas?
  const tienePermisos = filas.some(f => !!f.permiso);

  // 4) Armar encabezado dinámico
  const header = [
    { text: 'Fecha',   style: 'th' },
    { text: 'Entrada', style: 'th' },
    { text: 'Salida',  style: 'th' },
  ];
  if (tienePermisos) {
    header.push(
      { text: 'Permiso',        style: 'th' },
      { text: 'Motivo Permiso', style: 'th' }
    );
  }

  // 5) Construir body
  const body = [
    header,
    ...filas.map(f => {
      // parse fecha
      const [dd, mm, yyyy] = f.dia.split('/');
      const fechaDia = new Date(+yyyy, +mm - 1, +dd);
      fechaDia.setHours(0,0,0,0);

      const permiso = f.permiso || null;
      const esPerm   = !!permiso;

      // calcular finales
      let entradaFinal = f.entrada;
      let salidaFinal  = f.salida;
      if (esPerm) {
        entradaFinal = permiso.ini < (f.entrada||permiso.ini)
          ? permiso.ini : (f.entrada||permiso.ini);
        salidaFinal  = permiso.fin > (f.salida||permiso.fin)
          ? permiso.fin  : (f.salida||permiso.fin);
      }

      // colores
      let colorEnt, colorSal;
      // entrada
      if (entradaFinal) {
        const [hE, mE] = entradaFinal.split(':').map(Number);
        if (esPerm && entradaFinal === permiso.ini) {
          const dentro = (hE < corteEntH) || (hE === corteEntH && mE <= corteEntM);
          colorEnt = dentro ? 'blue' : 'red';
        } else {
          const tarde = hE > corteEntH || (hE === corteEntH && mE > corteEntM);
          colorEnt = tarde ? 'red' : undefined;
        }
      } else if (fechaDia <= new Date().setHours(0,0,0,0)) {
        colorEnt = 'red';
      }
      // salida
      if (salidaFinal) {
        const [hS, mS] = salidaFinal.split(':').map(Number);
        if (esPerm && salidaFinal === permiso.fin) {
          const dentro = (hS > corteSalH) || (hS === corteSalH && mS >= corteSalM);
          colorSal = dentro ? 'blue' : 'red';
        } else {
          const pronto = hS < corteSalH || (hS === corteSalH && mS < corteSalM);
          colorSal = pronto ? 'red' : undefined;
        }
      } else if (fechaDia <= new Date().setHours(0,0,0,0)) {
        colorSal = 'red';
      }

      // fila base
      const row = [
        { text: f.dia,               style: 'td' },
        { text: entradaFinal || '—', style: 'td', color: colorEnt },
        { text: salidaFinal  || '—', style: 'td', color: colorSal },
      ];

      // si hay permisos, agregamos columnas extras
      if (tienePermisos) {
        row.push(
          esPerm
            ? { text: `${permiso.ini} – ${permiso.fin}`, style: 'td', color: 'blue' }
            : { text: '', style: 'td' },
          esPerm
            ? { text: `${permiso.cat}: ${permiso.reason}`, style: 'td' }
            : { text: '', style: 'td' }
        );
      }

      return row;
    })
  ];

  // 6) Definir anchos según si hay permisos
  const colWidths = tienePermisos
    ? [70, 60, 60, 90, 140]
    : [70, 60, 60];

  // 7) Definición del PDF
  const docDefinition = {
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `reporte_${gafete}_${fechaIni.replace(/\//g,'-')}_${fechaFin.replace(/\//g,'-')}`
    },
    content: [
      { text: 'REPORTE DE ASISTENCIA', style: 'titulo' },
      { text: `Gafete: ${gafete}`,      margin: [0,0,0,2] },
      { text: `Nombre: ${nombre}`,      margin: [0,0,0,2] },
      { text: `Rango: ${fechaIni} – ${fechaFin}`, margin: [0,0,0,2] },
      { text: `Exportado: ${exportado}`, margin: [0,0,0,18], style: 'nota' },

      { text: 'Tiempo Tardío', style: 'subtitulo', margin: [0,0,0,6] },
      {
        margin: [0,0,0,18],
        table: {
          widths: ['*','*'],
          body: [
            [
              { text: `Minutos autorizados: ${minutosAutorizados}`, style: 'td' },
              { text: `Minutos netos: ${minutosNetos}`,            style: 'td' }
            ],
            [
              { text: `Minutos detectados: ${minutosDetectados}`, style: 'td' },
              { text: `Días sin marcaje: ${diasSinMarcaje}`,      style: 'td' }
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
          { width:'*', text: '' },
          {
            width: 'auto',
            table: {
              headerRows: 1,
              widths: colWidths,
              body
            },
            layout: {
              fillColor:  row => row === 0 ? '#E5E7EB' : null,
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#BDBDBD',
              vLineColor: () => '#BDBDBD'
            }
          },
          { width:'*', text: '' }
        ]
      }
    ],
    styles: {
      titulo:    { fontSize:14, bold:true, alignment:'center', margin:[0,0,0,12] },
      subtitulo: { fontSize:12, bold:true, margin:[0,2,0,6] },
      nota:      { fontSize:8, color:'#555' },
      th:        { fontSize:9, bold:true, alignment:'center', margin:[0,2,0,2] },
      td:        { fontSize:8, alignment:'center', margin:[0,2,0,2] }
    }
  };

  // 8) Generar PDF
  window.pdfMake.createPdf(docDefinition).open();
});

