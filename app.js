/* ─────────────────────────────────────────────────────────────
   Y-Reach Analytics · app.js
   Phase 3: Grant Matchmaker Logic (final).
───────────────────────────────────────────────────────────── */
 
const dropZone        = document.getElementById('drop-zone');
const csvInput        = document.getElementById('csv-input');
const statusText      = document.getElementById('status-text');
const statusPill      = document.getElementById('status-pill');
const fileLoadedBadge = document.getElementById('file-loaded-badge');
const fileNameDisplay = document.getElementById('file-name-display');
 
/* ── Chart instance registry ─────────────────────────────── */
const chartInstances = { age: null, geo: null, freq: null };
 
/* ═══════════════════════════════════════════════════════════════
   SHARED CHART STYLE TOKENS
═══════════════════════════════════════════════════════════════ */
const C = {
  amber:      '#E8A020',
  amberSoft:  '#F5C96A',
  amberDim:   'rgba(232,160,32,0.15)',
  gridLine:   '#243044',
  tickColor:  '#94a3b8',
  labelColor: '#e8edf3',
  fontMono:   '"IBM Plex Mono", monospace',
  fontBody:   'Manrope, sans-serif',
};
 
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
      titleFont: { family: C.fontMono, size: 11 },
      bodyFont:  { family: C.fontMono, size: 11 },
      padding: 10,
      callbacks: { label: (ctx) => `  ${ctx.parsed.x ?? ctx.parsed.y} members` },
    },
  },
  scales: {
    x: {
      grid:   { color: C.gridLine, drawBorder: false },
      ticks:  { color: C.tickColor, font: { family: C.fontMono, size: 11 } },
      border: { color: C.gridLine },
    },
    y: {
      grid:   { color: C.gridLine, drawBorder: false },
      ticks:  { color: C.tickColor, font: { family: C.fontMono, size: 11 }, precision: 0 },
      border: { color: C.gridLine },
    },
  },
};
 
function showCanvas(placeholderId, canvasId) {
  document.getElementById(placeholderId).classList.add('hidden');
  const canvas = document.getElementById(canvasId);
  canvas.classList.remove('hidden');
  return canvas.getContext('2d');
}
 
function safeDestroy(key) {
  if (chartInstances[key]) { chartInstances[key].destroy(); chartInstances[key] = null; }
}
 
/* ═══════════════════════════════════════════════════════════════
   RENDER CHARTS
═══════════════════════════════════════════════════════════════ */
function renderCharts(metrics) {
  safeDestroy('age');
  const AGE_ORDER = ['0-12', '13-17', '18-24', '25-64', '65+'];
  const ageCtx    = showCanvas('chart-age-placeholder', 'chart-age');
  chartInstances.age = new Chart(ageCtx, {
    type: 'bar',
    data: {
      labels:   AGE_ORDER,
      datasets: [{
        label:                'Unique Members',
        data:                 AGE_ORDER.map(b => metrics.ageBuckets[b] ?? 0),
        backgroundColor:      AGE_ORDER.map((_, i) => i <= 1 ? C.amber : C.amberDim),
        borderColor:          C.amber,
        borderWidth:          1,
        borderRadius:         4,
        hoverBackgroundColor: C.amberSoft,
      }],
    },
    options: {
      ...sharedOptions,
      plugins: { ...sharedOptions.plugins, tooltip: { ...sharedOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `  ${ctx.parsed.y} unique members` } } },
      scales: { ...sharedOptions.scales, y: { ...sharedOptions.scales.y,
        ticks: { ...sharedOptions.scales.y.ticks, stepSize: 1 } } },
    },
  });
 
  safeDestroy('geo');
  const geoSorted = Object.entries(metrics.geoImpact).sort(([, a], [, b]) => b - a);
  const geoCtx    = showCanvas('chart-geo-placeholder', 'chart-geo');
  chartInstances.geo = new Chart(geoCtx, {
    type: 'bar',
    data: {
      labels:   geoSorted.map(([zip]) => zip),
      datasets: [{
        label:                'Aid Members',
        data:                 geoSorted.map(([, count]) => count),
        backgroundColor:      C.amber,
        borderColor:          C.amberSoft,
        borderWidth:          1,
        borderRadius:         4,
        hoverBackgroundColor: C.amberSoft,
      }],
    },
    options: {
      ...sharedOptions,
      indexAxis: 'y',
      plugins: { ...sharedOptions.plugins, tooltip: { ...sharedOptions.plugins.tooltip,
        callbacks: { label: (ctx) => `  ${ctx.parsed.x} aid members` } } },
      scales: {
        x: { ...sharedOptions.scales.x, ticks: { ...sharedOptions.scales.x.ticks, stepSize: 1 } },
        y: { ...sharedOptions.scales.y, grid: { display: false } },
      },
    },
  });
 
  safeDestroy('freq');
  const freqCtx = showCanvas('chart-freq-placeholder', 'chart-freq');
  chartInstances.freq = new Chart(freqCtx, {
    type: 'bar',
    data: {
      labels:   ['Avg. Visits / Youth Member (on Aid)'],
      datasets: [
        {
          label:                'Average Visits',
          data:                 [metrics.youthAvgVisits],
          backgroundColor:      C.amber,
          borderColor:          C.amberSoft,
          borderWidth:          1,
          borderRadius:         4,
          hoverBackgroundColor: C.amberSoft,
        },
        {
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
      plugins: { ...sharedOptions.plugins,
        legend: { display: true, labels: { color: C.tickColor,
          font: { family: C.fontMono, size: 11 }, boxWidth: 12, padding: 16 } },
        tooltip: { ...sharedOptions.plugins.tooltip,
          callbacks: { label: (ctx) => `  ${ctx.parsed.x} visits` } },
      },
      scales: {
        x: { ...sharedOptions.scales.x, ticks: { ...sharedOptions.scales.x.ticks, stepSize: 0.5 },
          suggestedMax: Math.max(metrics.youthAvgVisits + 1, 3) },
        y: { ...sharedOptions.scales.y, grid: { display: false } },
      },
    },
  });
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
  if (age <= 12) return '0-12';
  if (age <= 17) return '13-17';
  if (age <= 24) return '18-24';
  if (age <= 64) return '25-64';
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
  const totalUnique   = uniqueMembers.length;
 
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
  const counts         = Object.values(youthAidVisits);
  const youthAvgVisits = counts.length
    ? Math.round((counts.reduce((s, n) => s + n, 0) / counts.length) * 10) / 10
    : 0;
 
  const metrics = {
    totalUnique,
    ageBuckets,
    geoImpact,
    youthAvgVisits,
    assistanceCount: uniqueMembers.filter(m => m.Financial_Assistance_Flag).length,
    zipCount:        Object.keys(geoImpact).length,
    // Derived facility tags used by the matchmaker
    hasYouth:        uniqueMembers.some(m => m.Age < 18),
    hasLowIncome:    uniqueMembers.some(m => m.Financial_Assistance_Flag),
  };
 
  console.log('Y-Reach · Analytics Complete', metrics);
 
  updateKPIs(metrics);
  renderCharts(metrics);
 
  // Fetch grants.json then run matchmaker — charts render in parallel
  fetchGrants(metrics);
}
 
function updateKPIs(metrics) {
  document.getElementById('kpi-unique').textContent     = metrics.totalUnique;
  document.getElementById('kpi-assistance').textContent = metrics.assistanceCount;
  document.getElementById('kpi-zips').textContent       = metrics.zipCount;
  document.getElementById('kpi-youth-avg').textContent  = metrics.youthAvgVisits;
}
 
/* ═══════════════════════════════════════════════════════════════
   GRANT MATCHMAKER
═══════════════════════════════════════════════════════════════ */
 
/* ── fetchGrants: load the static grants.json ────────────────
   Like opening a reference book stored on the same shelf —
   no server round-trip, just a local file fetch.             */
async function fetchGrants(metrics) {
  // Collapse shimmer, block empty state — we're working
  document.getElementById('grants-shimmer').classList.add('hidden');
  document.getElementById('grants-empty-state').classList.add('hidden');
 
  let grants = [];
  try {
    const resp = await fetch('./grants.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    grants = await resp.json();
    console.log(`Y-Reach · ${grants.length} grants loaded from grants.json`);
 
    // Surface the live database count badge
    const metaEl = document.getElementById('grants-meta');
    metaEl.classList.remove('hidden');
    metaEl.classList.add('flex');
    document.getElementById('grants-meta-text').textContent =
      `${grants.length} grant${grants.length !== 1 ? 's' : ''} in database`;
 
  } catch (err) {
    console.error('Y-Reach · Failed to load grants.json —', err);
    setStatus('error', 'Could not load grants database');
    return;
  }
 
  const matches = evaluateMatches(metrics, grants);
  renderGrantCards(matches);
  setStatus('done', `Matches found · ${matches.length} recommendations`);
}
 
/* ── buildFacilityTags: derive active demographic tags ───────
   Think of these as the facility's résumé:
   the hard facts that grant committees want to verify.       */
function buildFacilityTags(metrics) {
  const tags = [];
  if (metrics.hasYouth)     tags.push('youth');
  if (metrics.hasLowIncome) tags.push('low-income');
  // Extend here in future phases (e.g. 'senior', 'disability')
  return tags;
}
 
/* ── evaluateMatches: score, filter, and rank grants ─────────
   Scoring is split into two equally-weighted halves — like a
   job interview with a skills test (50%) and a deadline
   urgency check (50%):
 
   DEMOGRAPHIC MATCH (0–50 pts)
     % of the grant's required tags present in facility tags
     × 50. A grant needing ['youth','low-income'] where the
     facility only has ['youth'] earns 25/50.
 
   URGENCY BONUS (0–50 pts)
     ≤ 30 days  → 50 pts  (apply now)
     31–90 days → 25 pts  (on the horizon)
     > 90 days  → 0 pts   (no urgency premium)
     No deadline → 0 pts
─────────────────────────────────────────────────────────── */
function evaluateMatches(metrics, grants) {
  const facilityTags = buildFacilityTags(metrics);
  const today        = new Date();
  today.setHours(0, 0, 0, 0);
 
  const scored = grants
    // ── FILTER: hard eligibility thresholds ──────────────
    .filter(g =>
      metrics.totalUnique   >= (g.min_unique_members   ?? 0) &&
      metrics.assistanceCount >= (g.min_subsidized_youth ?? 0)
    )
    // ── SCORE: demographic match + urgency ───────────────
    .map(g => {
      // Demographic score (0–50)
      const grantTags     = g.target_demographics ?? [];
      const matchedTags   = grantTags.filter(t => facilityTags.includes(t));
      const demoScore     = grantTags.length > 0
        ? (matchedTags.length / grantTags.length) * 50
        : 0;
 
      // Urgency score (0–50)
      let urgencyScore = 0;
      if (g.deadline) {
        const deadline    = new Date(g.deadline);
        const daysLeft    = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 30)  urgencyScore = 50;
        else if (daysLeft <= 90)              urgencyScore = 25;
      }
 
      const totalScore = Math.round(demoScore + urgencyScore);
 
      return {
        ...g,
        _score:       totalScore,       // 0–100
        _matchedTags: matchedTags,      // for tag highlight in UI
        _daysLeft:    g.deadline
          ? Math.ceil((new Date(g.deadline) - today) / (1000 * 60 * 60 * 24))
          : null,
      };
    })
    // ── RANK: highest score first ─────────────────────────
    .sort((a, b) => b._score - a._score);
 
  console.log('Y-Reach · Matchmaker results', scored);
  return scored.slice(0, 3);   // top 3 only
}
 
/* ── scoreLabel: human-readable tier for the match bar ───── */
function scoreLabel(score) {
  if (score >= 75) return { text: 'High Match',    color: 'text-green-400',  bar: '#4ade80' };
  if (score >= 40) return { text: 'Medium Match',  color: 'text-amber-brand',bar: '#E8A020' };
  return               { text: 'Low Match',     color: 'text-slate-400',  bar: '#475569' };
}
 
/* ── formatAmount: $10000,$50000 → "$10k – $50k" ────────── */
function formatAmount(min, max) {
  const fmt = n => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
  if (!min && !max) return 'Amount TBD';
  if (!min)         return `Up to ${fmt(max)}`;
  if (min === max)  return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}
 
/* ── formatDeadline: ISO string → "Nov 1, 2025" ─────────── */
function formatDeadline(iso) {
  if (!iso) return 'Rolling';
  const d = new Date(iso + 'T00:00:00'); // force local midnight
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
 
/* ── renderGrantCards: build and inject card HTML ─────────── */
function renderGrantCards(matches) {
  const grid = document.getElementById('grants-grid');
 
  if (!matches.length) {
    // No qualifying grants — show inline notice inside the grid area
    grid.innerHTML = `
      <div class="md:col-span-3 flex flex-col items-center justify-center text-center py-16
                  rounded-xl border border-dashed border-slate-border">
        <p class="font-display text-white text-lg">No qualifying grants found</p>
        <p class="font-mono text-[11px] text-slate-500 mt-2 max-w-xs">
          Your facility does not yet meet the minimum thresholds for grants in the current database.
          Try uploading a larger dataset.
        </p>
      </div>`;
    grid.classList.remove('hidden');
    return;
  }
 
  grid.innerHTML = matches.map(g => {
    const { text: scoreText, color: scoreColor, bar: barColor } = scoreLabel(g._score);
 
    // Pill badge HTML builder
    const badge = (icon, content, extraClass = '') => `
      <span class="flex items-center gap-1.5 font-mono text-[11px] bg-navy
                   border border-slate-border rounded-full px-3 py-1 ${extraClass}">
        ${icon}${content}
      </span>`;
 
    const dollarIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 flex-shrink-0"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879
           1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725
           0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879
           4.006 0l.415.33" />
    </svg>`;
 
    const calIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 flex-shrink-0"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0
           012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18
           0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021
           18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25
           2.25 0 0121 11.25v7.5" />
    </svg>`;
 
    // Urgency label suffix on deadline badge
    const urgency = g._daysLeft !== null && g._daysLeft >= 0 && g._daysLeft <= 30
      ? ` <span class="text-red-400">· ${g._daysLeft}d left</span>` : '';
 
    // Demographic tag pills — matched tags full amber, others dimmed
    const tagPills = (g.target_demographics ?? []).map(tag => {
      const isMatch = g._matchedTags.includes(tag);
      const label   = tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `<span class="font-mono text-[10px] uppercase tracking-wide rounded-full px-2.5 py-1
                ${isMatch
                  ? 'bg-amber-brand/10 text-amber-brand border border-amber-brand/25'
                  : 'bg-slate-border/30 text-slate-500 border border-slate-border'
                }">${label}</span>`;
    }).join('');
 
    return `
      <div class="grant-card rounded-xl bg-slate-card border border-slate-border p-5
                  flex flex-col gap-4">
 
        <!-- Header -->
        <div>
          <p class="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1 truncate">
            ${g.funder ?? 'Unknown Funder'}
          </p>
          <h3 class="font-display text-lg text-white leading-snug">${g.title}</h3>
        </div>
 
        <!-- Description -->
        <p class="font-body text-slate-400 text-xs leading-relaxed"
           style="-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;">
          ${g.description ?? ''}
        </p>
 
        <!-- KPI Badges -->
        <div class="flex flex-wrap gap-2">
          ${badge(dollarIcon, formatAmount(g.amount_min, g.amount_max), 'text-amber-brand')}
          ${badge(calIcon,    `${formatDeadline(g.deadline)}${urgency}`, 'text-slate-300')}
        </div>
 
        <!-- Demographic Tags -->
        <div class="flex flex-wrap gap-1.5">${tagPills}</div>
 
        <!-- Match Score (pinned to card bottom) -->
        <div class="flex flex-col gap-1.5 mt-auto pt-3 border-t border-slate-border">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Compatibility
            </span>
            <span class="font-mono text-xs font-medium ${scoreColor}">
              ${g._score}% · ${scoreText}
            </span>
          </div>
          <div class="match-bar-track h-1.5 w-full">
            <!-- Width starts at 0; CSS transition animates to final value -->
            <div class="match-bar-fill h-full"
                 style="width:0%; background-color:${barColor};"
                 data-target-width="${g._score}%">
            </div>
          </div>
        </div>
 
        <!-- Action -->
        <a href="${g.url ?? '#'}" target="_blank" rel="noopener noreferrer"
           class="btn-grant mt-1 block text-center font-mono text-xs font-medium
                  border border-amber-brand/40 text-amber-brand rounded-lg py-2.5 px-4">
          View Grant →
        </a>
 
      </div>`;
  }).join('');
 
  grid.classList.remove('hidden');
 
  /* Animate match bars after a single paint frame — the CSS
     transition needs width:0% to be rendered first, otherwise
     it jumps straight to the target (like pressing play on a
     video that's already halfway through).                    */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      grid.querySelectorAll('.match-bar-fill[data-target-width]').forEach(bar => {
        bar.style.width = bar.dataset.targetWidth;
      });
    });
  });
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
