/* --------------------------------------------------------------------- *
 *  renderer.js – asistencia + permisos y exportación PDF                *
 * --------------------------------------------------------------------- */

/* ========== 0. Referencias de elementos ============================== */
const circle     = document.getElementById('circle');
const statusSpan = document.getElementById('status');
const btnExport  = document.getElementById('btnExport');

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

    const esPermiso    = !!f.permiso;
    const sinMarcacion = !f.entrada && !f.salida && !esPermiso;

    let claseEnt  = 'text-gray-400 italic';
    let claseSal  = 'text-gray-400 italic';
    let claseHoras= sinMarcacion ? 'text-gray-400 italic' : 'text-gray-800 font-bold';

    if (esPermiso) {
      claseEnt = claseSal = claseHoras = 'text-blue-600 font-semibold';
    } else if (!sinMarcacion) {
      const [hE, mE] = (f.entrada || '00:00').split(':').map(Number);
      const [hS, mS] = (f.salida  || '00:00').split(':').map(Number);
      const tarde  = hE > 8 || (hE === 8 && mE > 0);
      const pronto = hS < 15 || (hS === 15 && mS < 30);
      claseEnt = tarde  ? 'text-red-600 font-semibold' : 'text-gray-800';
      claseSal = pronto ? 'text-red-600 font-semibold' : 'text-gray-800';
    }

    const horasHtml = esPermiso
      ? `${f.permiso.ini}-${f.permiso.fin}<span class="ml-1 text-blue-500 cursor-help" title="${f.permiso.cat} – ${f.permiso.reason}">ℹ︎</span>`
      : (f.horas || '0.0 h');

    tr.innerHTML = `
      <td class="border p-3 text-sm text-gray-800 font-medium">${f.dia}</td>
      <td class="border p-3 text-sm ${claseEnt} text-center">${f.entrada || (esPermiso ? '—' : '-- sin marcación --')}</td>
      <td class="border p-3 text-sm ${claseSal} text-center">${f.salida  || (esPermiso ? '—' : '-- sin marcación --')}</td>
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

/* ---------- 4. Botón “Consultar” ------------------------------------- */
document.getElementById('btn').addEventListener('click', async () => {
  const empCode = String(window.__empCode ?? '').trim();
  const fi = document.getElementById('fi').value;
  const ff = document.getElementById('ff').value;

  if (!empCode || !fi || !ff) {
    alert('Complete todos los campos');
    return;
  }

  setExportEnabled(false);

  try {
    const empleado = await window.api.obtenerEmpleadoDesdePersonnel(empCode);
    const reporte  = await window.api.obtenerReporteAsistencia(empleado.id, fi, ff);

    const mapa = Object.fromEntries(
      reporte.map(r => {
        const [dd, mm, yyyy] = r.att_date.split('-');
        const fechaKey = `${dd}/${mm}/${yyyy}`;
        return [fechaKey, {
          dia    : fechaKey,
          entrada: r.first_punch || '',
          salida : r.last_punch  || '',
          horas  : r.total_time?.toFixed(1) || ''
        }];
      })
    );

    const permisos = await window.api.obtenerPermisos(empCode, fi, ff);
    permisos.forEach(p => {
      const [startDate, startTime] = p.start_time.split(' ');
      const [endDate,   endTime  ] = p.end_time.split(' ');
      const [yyyy, mm, dd] = startDate.split('-');
      const fechaKey = `${dd}/${mm}/${yyyy}`;

      const salidaPermiso = endTime.slice(0, 5);
      const existente = mapa[fechaKey];

      mapa[fechaKey] = {
        dia     : fechaKey,
        entrada : startTime.slice(0, 5),
        salida  : (existente?.salida && existente.salida > salidaPermiso)
                    ? existente.salida
                    : salidaPermiso,
        horas   : existente?.horas || '',
        permiso : {
          ini   : startTime.slice(0, 5),
          fin   : endTime.slice(0, 5),
          cat   : p.category,
          reason: p.apply_reason.trim()
        }
      };
    });


    const [anio, mes] = fi.split('-').map(Number);
    const filas = obtenerDiasHabilesMes(anio, mes).map(d =>
      mapa[d] || { dia:d, entrada:'', salida:'', horas:'' }
    );

    render(filas);
    
    setExportEnabled(true);

    window.__empCode   = empCode;
    window.__empNombre = window.catalogo?.porGafete(empCode)?.nombre || '';
    window.__startDate = fi;
    window.__endDate   = ff;


   // ==============================
  // Cálculo: Tiempo Tardío
  // ==============================
  const minutosAutorizados = 30;
  let minutosTardiosDetectados = 0;

  // Solo considerar días con al menos una marcación válida
  filas.forEach(f => {
    if (!f.entrada && !f.salida) return;

    if (f.entrada) {
      const [hE, mE] = f.entrada.split(':').map(Number);
      if (hE > 8 || (hE === 8 && mE > 0)) {
        const minutosEntrada = (hE - 8) * 60 + mE;
        minutosTardiosDetectados += minutosEntrada;
      }
    }

    if (f.salida) {
      const [hS, mS] = f.salida.split(':').map(Number);
      if (hS < 15 || (hS === 15 && mS < 30)) {
        const minutosSalida = (15 - hS) * 60 + (30 - mS);
        minutosTardiosDetectados += minutosSalida;
      }
    }
  });

const minutosNetos = Math.max(minutosTardiosDetectados - minutosAutorizados, 0);

// ==============================
// Mostrar en UI
// ==============================
const tardiosDiv = document.getElementById('tardios');
tardiosDiv.innerHTML = `
  <div class="p-4 bg-yellow-100 border border-yellow-400 rounded text-sm text-yellow-800">
    <p><strong>Tiempo Tardío</strong></p>
    <p>Minutos autorizados tardíos: <strong>${minutosAutorizados}</strong></p>
    <p>Minutos tardíos detectados: <strong>${minutosTardiosDetectados}</strong></p>
    <p>Minutos tardíos netos: <strong>${minutosNetos}</strong></p>
  </div>
`;


  } catch (err) {
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
  const btnConsultar  = document.getElementById('btn');
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

    poolInfo.forEach(info => {
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
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
  });

  // =====================================
  // Cálculo: Tiempo Tardío
  // =====================================
  const minutosAutorizados = 30;
  let minutosTardiosDetectados = 0;

  filas.forEach(f => {
    if (!f.entrada && !f.salida) return;

    if (f.entrada) {
      const [hE, mE] = f.entrada.split(':').map(Number);
      if (hE > 8 || (hE === 8 && mE > 0)) {
        const minutosEntrada = (hE - 8) * 60 + mE;
        minutosTardiosDetectados += minutosEntrada;
      }
    }

    if (f.salida) {
      const [hS, mS] = f.salida.split(':').map(Number);
      if (hS < 15 || (hS === 15 && mS < 30)) {
        const minutosSalida = (15 - hS) * 60 + (30 - mS);
        minutosTardiosDetectados += minutosSalida;
      }
    }
  });

  const minutosNetos = Math.max(minutosTardiosDetectados - minutosAutorizados, 0);

  // =====================================
  // Cuerpo de tabla de asistencia
  // =====================================
  const body = [
    [ {text:'Fecha',style:'th'}, {text:'Entrada',style:'th'},
      {text:'Salida',style:'th'}, {text:'Horas/Permiso',style:'th'} ],
    ...filas.map(f=>{
      const esPermiso = !!f.permiso;
      const [hE=0,mE=0] = (f.entrada||'').split(':').map(Number);
      const [hS=0,mS=0] = (f.salida ||'').split(':').map(Number);
      const entradaTarde = !esPermiso && (hE>8||(hE===8&&mE>0));
      const salidaPronto = !esPermiso && (hS<15||(hS===15&&mS<30));
      return [
        { text:f.dia,            style:'td' },
        { text:f.entrada||'—',   style:'td',
          color: esPermiso?'blue':(entradaTarde?'red':undefined) },
        { text:f.salida ||'—',   style:'td',
          color: esPermiso?'blue':(salidaPronto?'red':undefined) },
        { text: esPermiso?`${f.permiso.ini} – ${f.permiso.fin}`:(f.horas||''),
          style:'td', color: esPermiso?'blue':undefined, noWrap:false }
      ];
    })
  ];

  const docDefinition = {
    pageMargins:[40,60,40,60],
    info:{ title:`reporte_${gafete}_${fechaIni.replace(/\//g,'-')}_${fechaFin.replace(/\//g,'-')}` },
    content:[
      { text:'REPORTE DE ASISTENCIA', style:'titulo' },
      { text:`Gafete: ${gafete}`,               margin:[0,0,0,2] },
      { text:`Nombre: ${nombre}`,               margin:[0,0,0,2] },
      { text:`Rango de fechas: ${fechaIni} – ${fechaFin}`, margin:[0,0,0,2] },
      { text:`Exportado el: ${exportado}`,      margin:[0,0,0,18], style:'nota' },

      // Sección: Tiempo Tardío
      {
        margin: [0, 0, 0, 18],
        style: 'tardioBox',
        table: {
          widths: ['*'],
          body: [
            [{ text: 'Tiempo Tardío', style: 'subtitulo' }],
            [{ text: `Minutos autorizados tardíos: ${minutosAutorizados}` }],
            [{ text: `Minutos tardíos detectados: ${minutosTardiosDetectados}` }],
            [{ text: `Minutos tardíos netos: ${minutosNetos}` }]
          ]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 2,
          paddingBottom: () => 2,
          fillColor: () => '#FEF3C7'
        }
      },

      // Sección: Tabla de asistencia
      {
        columns:[
          { width:'*',  text:'' },
          {
            width:'auto',
            table:{ headerRows:1, widths:[70,60,60,90], body },
            layout:{
              fillColor:(row)=> row===0 ? '#E5E7EB' : null,
              hLineWidth:()=>0.5, vLineWidth:()=>0.5,
              hLineColor:()=>'#BDBDBD', vLineColor:()=>'#BDBDBD'
            }
          },
          { width:'*',  text:'' }
        ]
      }
    ],
    styles:{
      titulo   :{ fontSize:14, bold:true, alignment:'center', margin:[0,0,0,12] },
      subtitulo:{ fontSize:12, bold:true, margin:[0,2,0,6] },
      nota     :{ fontSize:8,  color:'#555' },
      th       :{ fontSize:9,  bold:true, alignment:'center', margin:[0,2,0,2] },
      td       :{ fontSize:8,  alignment:'center', margin:[0,2,0,2] },
      tardioBox:{ fontSize:9,  color:'#92400E', margin:[0,0,0,12] }
    }
  };

  window.pdfMake.createPdf(docDefinition).open();
});

