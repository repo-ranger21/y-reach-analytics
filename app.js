/* ─────────────────────────────────────────────────────────────
   Y-Reach Analytics · app.js
   Phase 4: Data Visualization (final).
───────────────────────────────────────────────────────────── */

const dropZone        = document.getElementById('drop-zone');
const csvInput        = document.getElementById('csv-input');
const statusText      = document.getElementById('status-text');
const statusPill      = document.getElementById('status-pill');
const fileLoadedBadge = document.getElementById('file-loaded-badge');
const fileNameDisplay = document.getElementById('file-name-display');

/* ── Chart instance registry — prevents ghost-chart overlap ────
   Like keeping a reference to an open window before replacing
   it: always close the old one before opening the new one.     */
const chartInstances = {
  age:  null,
  geo:  null,
  freq: null,
};

/* ═══════════════════════════════════════════════════════════════
   SHARED CHART STYLE TOKENS
═══════════════════════════════════════════════════════════════ */
const C = {
  amber:        '#E8A020',
  amberSoft:    '#F5C96A',
  amberDim:     'rgba(232,160,32,0.15)',
  gridLine:     '#243044',
  tickColor:    '#94a3b8',
  labelColor:   '#e8edf3',
  fontMono:     '"IBM Plex Mono", monospace',
  fontBody:     'Manrope, sans-serif',
};

/* Shared plugin defaults applied to every chart */
const sharedOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#162033',
      borderColor: C.gridLine,
      borderWidth: 1,
      titleColor: C.labelColor,
      bodyColor: C.tickColor,
      titleFont:  { family: C.fontMono, size: 11 },
      bodyFont:   { family: C.fontMono, size: 11 },
      padding: 10,
      callbacks: {
        // Append "members" unit to every tooltip value
        label: (ctx) => `  ${ctx.parsed.x ?? ctx.parsed.y} members`,
      },
    },
  },
  scales: {
    x: {
      grid:  { color: C.gridLine, drawBorder: false },
      ticks: { color: C.tickColor, font: { family: C.fontMono, size: 11 } },
      border: { color: C.gridLine },
    },
    y: {
      grid:  { color: C.gridLine, drawBorder: false },
      ticks: { color: C.tickColor, font: { family: C.fontMono, size: 11 }, precision: 0 },
      border: { color: C.gridLine },
    },
  },
};

/* ── showCanvas: swap shimmer placeholder → real canvas ─────── */
function showCanvas(placeholderId, canvasId) {
  document.getElementById(placeholderId).classList.add('hidden');
  const canvas = document.getElementById(canvasId);
  canvas.classList.remove('hidden');
  return canvas.getContext('2d');
}

/* ── safeDestroy: kill existing instance before re-render ────── */
function safeDestroy(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    chartInstances[key] = null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER CHARTS
═══════════════════════════════════════════════════════════════ */
function renderCharts(metrics) {

  /* ── Chart 1: Age Demographics — Vertical Bar ───────────────
     Buckets are already in grant-standard order; preserve that
     order explicitly so JS object key iteration can't scramble it. */
  safeDestroy('age');
  const AGE_ORDER = ['0-12', '13-17', '18-24', '25-64', '65+'];
  const ageCtx    = showCanvas('chart-age-placeholder', 'chart-age');

  chartInstances.age = new Chart(ageCtx, {
    type: 'bar',
    data: {
      labels:   AGE_ORDER,
      datasets: [{
        label:           'Unique Members',
        data:            AGE_ORDER.map(b => metrics.ageBuckets[b] ?? 0),
        backgroundColor: AGE_ORDER.map((_, i) =>
          // Highlight youth brackets (grant-priority) in full amber; adults dimmed
          i <= 1 ? C.amber : C.amberDim
        ),
        borderColor:     C.amber,
        borderWidth:     1,
        borderRadius:    4,
        hoverBackgroundColor: C.amberSoft,
      }],
    },
    options: {
      ...sharedOptions,
      plugins: {
        ...sharedOptions.plugins,
        tooltip: {
          ...sharedOptions.plugins.tooltip,
          callbacks: {
            label: (ctx) => `  ${ctx.parsed.y} unique members`,
          },
        },
      },
      scales: {
        ...sharedOptions.scales,
        y: {
          ...sharedOptions.scales.y,
          ticks: {
            ...sharedOptions.scales.y.ticks,
            stepSize: 1,
          },
        },
      },
    },
  });

  /* ── Chart 2: Geospatial Impact — Horizontal Bar ────────────
     Sort zip codes highest → lowest so grant readers see the
     most-impacted communities first (like a leaderboard).      */
  safeDestroy('geo');
  const geoSorted = Object.entries(metrics.geoImpact)
    .sort(([, a], [, b]) => b - a); // descending by member count

  const geoCtx = showCanvas('chart-geo-placeholder', 'chart-geo');

  chartInstances.geo = new Chart(geoCtx, {
    type: 'bar',
    data: {
      labels:   geoSorted.map(([zip]) => zip),
      datasets: [{
        label:           'Aid Members',
        data:            geoSorted.map(([, count]) => count),
        backgroundColor: C.amber,
        borderColor:     C.amberSoft,
        borderWidth:     1,
        borderRadius:    4,
        hoverBackgroundColor: C.amberSoft,
      }],
    },
    options: {
      ...sharedOptions,
      indexAxis: 'y',   // flip to horizontal
      plugins: {
        ...sharedOptions.plugins,
        tooltip: {
          ...sharedOptions.plugins.tooltip,
          callbacks: {
            label: (ctx) => `  ${ctx.parsed.x} aid members`,
          },
        },
      },
      scales: {
        x: {
          ...sharedOptions.scales.x,
          ticks: { ...sharedOptions.scales.x.ticks, stepSize: 1 },
        },
        y: {
          ...sharedOptions.scales.y,
          grid: { display: false },
        },
      },
    },
  });

  /* ── Chart 3: Youth Attendance Frequency — Single-value KPI bar
     Renders one horizontal bar showing the average vs a
     reference line at 1.0 — a quick visual anchor for reviewers. */
  safeDestroy('freq');
  const freqCtx = showCanvas('chart-freq-placeholder', 'chart-freq');

  chartInstances.freq = new Chart(freqCtx, {
    type: 'bar',
    data: {
      labels:   ['Avg. Visits / Youth Member (on Aid)'],
      datasets: [
        {
          label:           'Average Visits',
          data:            [metrics.youthAvgVisits],
          backgroundColor: C.amber,
          borderColor:     C.amberSoft,
          borderWidth:     1,
          borderRadius:    4,
          hoverBackgroundColor: C.amberSoft,
        },
        {
          // Baseline reference bar so the value isn't floating in space
          label:           'Baseline (1 visit)',
          data:            [1],
          backgroundColor: 'rgba(148,163,184,0.12)',
          borderColor:     'rgba(148,163,184,0.3)',
          borderWidth:     1,
          borderRadius:    4,
        },
      ],
    },
    options: {
      ...sharedOptions,
      indexAxis: 'y',
      plugins: {
        ...sharedOptions.plugins,
        legend: {
          display: true,
          labels: {
            color:     C.tickColor,
            font:      { family: C.fontMono, size: 11 },
            boxWidth:  12,
            padding:   16,
          },
        },
        tooltip: {
          ...sharedOptions.plugins.tooltip,
          callbacks: {
            label: (ctx) => `  ${ctx.parsed.x} visits`,
          },
        },
      },
      scales: {
        x: {
          ...sharedOptions.scales.x,
          ticks: { ...sharedOptions.scales.x.ticks, stepSize: 0.5 },
          suggestedMax: Math.max(metrics.youthAvgVisits + 1, 3),
        },
        y: {
          ...sharedOptions.scales.y,
          grid: { display: false },
        },
      },
    },
  });

  setStatus('done', 'Complete · Ready for export');
}

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS ENGINE
═══════════════════════════════════════════════════════════════ */
function sanitizeRow(row) {
  row.Zip_Code = String(row.Zip_Code ?? '').trim().slice(0, 5);
  const raw = String(row.Financial_Assistance_Flag ?? '').trim().toLowerCase();
  row.Financial_Assistance_Flag = raw === 'true' || raw === 'yes' || raw === 'y' || raw === '1';
  return row;
}

function ageBucket(age) {
  if (age <=  12) return '0-12';
  if (age <=  17) return '13-17';
  if (age <=  24) return '18-24';
  if (age <=  64) return '25-64';
  return '65+';
}

function analyseData(rawData) {
  setStatus('processing', 'Analyzing…');

  const data = rawData.map(sanitizeRow);

  const memberMap = new Map();
  for (const row of data) {
    if (!memberMap.has(row.Member_ID)) memberMap.set(row.Member_ID, row);
  }
  const uniqueMembers = [...memberMap.values()];

  const totalUnique = uniqueMembers.length;

  const ageBuckets = { '0-12': 0, '13-17': 0, '18-24': 0, '25-64': 0, '65+': 0 };
  for (const m of uniqueMembers) ageBuckets[ageBucket(m.Age)]++;

  const geoImpact = {};
  for (const m of uniqueMembers) {
    if (m.Financial_Assistance_Flag)
      geoImpact[m.Zip_Code] = (geoImpact[m.Zip_Code] ?? 0) + 1;
  }

  const youthAidVisits = {};
  for (const row of data) {
    if (row.Age <= 17 && row.Financial_Assistance_Flag)
      youthAidVisits[row.Member_ID] = (youthAidVisits[row.Member_ID] ?? 0) + 1;
  }
  const counts          = Object.values(youthAidVisits);
  const youthAvgVisits  = counts.length
    ? Math.round((counts.reduce((s, n) => s + n, 0) / counts.length) * 10) / 10
    : 0;

  const metrics = {
    totalUnique,
    ageBuckets,
    geoImpact,
    youthAvgVisits,
    assistanceCount: uniqueMembers.filter(m => m.Financial_Assistance_Flag).length,
    zipCount:        Object.keys(geoImpact).length,
  };

  console.log('Y-Reach · Analytics Complete', metrics);

  updateKPIs(metrics);
  renderCharts(metrics);
}

function updateKPIs(metrics) {
  document.getElementById('kpi-unique').textContent     = metrics.totalUnique;
  document.getElementById('kpi-assistance').textContent = metrics.assistanceCount;
  document.getElementById('kpi-zips').textContent       = metrics.zipCount;
  document.getElementById('kpi-youth-avg').textContent  = metrics.youthAvgVisits;
}

/* ═══════════════════════════════════════════════════════════════
   CSV INGESTION
═══════════════════════════════════════════════════════════════ */
function parseCSV(file) {
  setStatus('processing', 'Processing…');
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete(results) {
      console.group('Y-Reach · CSV Parse Complete');
      console.log('Row count :', results.data.length);
      console.log('Fields    :', results.meta.fields);
      console.log('Data      :', results.data);
      console.groupEnd();
      if (results.errors.length) console.warn('Parse warnings:', results.errors);
      analyseData(results.data);
    },
    error(err) {
      console.error('Papa Parse error:', err);
      setStatus('error', `Parse failed — ${err.message}`);
    },
  });
}

function handleFile(file) {
  if (!file.name.endsWith('.csv')) {
    setStatus('error', 'Invalid file type — please upload a .csv');
    return;
  }
  fileNameDisplay.textContent = `${file.name} loaded`;
  fileLoadedBadge.classList.remove('hidden');
  fileLoadedBadge.classList.add('flex');
  parseCSV(file);
}

/* ═══════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
['dragleave', 'dragend'].forEach(evt =>
  dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'))
);
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
csvInput.addEventListener('change', () => {
  if (csvInput.files[0]) handleFile(csvInput.files[0]);
});

/* ── Status pill helper ─────────────────────────────────────── */
function setStatus(state, message) {
  const dot = statusPill.querySelector('span');
  const colors = {
    idle:       'bg-slate-500',
    ready:      'bg-amber-400',
    processing: 'bg-blue-400',
    done:       'bg-green-400',
    error:      'bg-red-400',
  };
  dot.className = `w-2 h-2 rounded-full inline-block ${colors[state] ?? colors.idle}`;
  statusText.textContent = message;
}
