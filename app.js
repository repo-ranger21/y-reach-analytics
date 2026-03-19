App · JS
Copy

/* ─────────────────────────────────────────────────────────────
   Y-Reach / RIEC-Reach Analytics · app.js
   Phase 4+: Multi-org profile support (YMCA + RIEC).
───────────────────────────────────────────────────────────── */
 
const dropZone        = document.getElementById('drop-zone');
const csvInput        = document.getElementById('csv-input');
const statusText      = document.getElementById('status-text');
const statusPill      = document.getElementById('status-pill');
const fileLoadedBadge = document.getElementById('file-loaded-badge');
const fileNameDisplay = document.getElementById('file-name-display');
 
/* Module-level state */
let _metrics     = null;
let _orgProfile  = 'ymca';   // 'ymca' | 'riec'  — set by detectOrgProfile()
 
/* ── Chart instance registry ─────────────────────────────── */
const chartInstances = { age: null, geo: null, freq: null };
 
/* ═══════════════════════════════════════════════════════════════
   ORG PROFILE DETECTION
   Like a key card reader: the uploaded filename is scanned for
   known org identifiers before any data is processed. This
   gates the correct tag set and UI branding downstream.
═══════════════════════════════════════════════════════════════ */
 
/* Known RIEC signals — checked against filename and Member_ID prefixes */
const RIEC_SIGNALS = ['riec', 'ri education center', 'ri-ed', 'hope', 'riecenter'];
 
function detectOrgProfile(file, rawData) {
  const filenameLower = file.name.toLowerCase();
 
  // ① Filename match (fastest, most reliable signal)
  if (RIEC_SIGNALS.some(s => filenameLower.includes(s))) return 'riec';
 
  // ② Member_ID prefix scan — RIEC IDs expected as 'R-XXXX' or 'RIEC-XXXX'
  if (rawData?.length) {
    const sample = rawData.slice(0, 20);
    const riecIds = sample.filter(row => {
      const id = String(row.Member_ID ?? '').toUpperCase();
      return id.startsWith('R-') || id.startsWith('RIEC');
    });
    if (riecIds.length >= sample.length * 0.5) return 'riec';
  }
 
  return 'ymca';
}
 
/* ── applyOrgBranding: update nav wordmark for active profile ──
   Touches only the two text nodes inside the existing nav
   structure — no structural HTML changes required.            */
function applyOrgBranding(profile) {
  const wordmark = document.querySelector('header .font-display');
  const byline   = document.querySelector('header .font-mono');
 
  if (!wordmark || !byline) return;
 
  if (profile === 'riec') {
    wordmark.textContent = 'RIEC-Reach Analytics';
    byline.textContent   = 'by Logic Foundry · RIEC Profile';
 
    // Swap the Y glyph tile to show 'R'
    const glyph = document.querySelector('header .bg-amber-brand span');
    if (glyph) glyph.textContent = 'R';
  } else {
    wordmark.textContent = 'Y-Reach Analytics';
    byline.textContent   = 'by Logic Foundry';
    const glyph = document.querySelector('header .bg-amber-brand span');
    if (glyph) glyph.textContent = 'Y';
  }
}
 
 
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
      borderColor:     C.gridLine,
      borderWidth:     1,
      titleColor:      C.labelColor,
      bodyColor:       C.tickColor,
      titleFont:       { family: C.fontMono, size: 11 },
      bodyFont:        { family: C.fontMono, size: 11 },
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
 
function analyseData(rawData, file) {
  setStatus('processing', 'Analyzing…');
 
  // ── Detect org profile BEFORE metrics are computed ──────
  _orgProfile = detectOrgProfile(file, rawData);
  applyOrgBranding(_orgProfile);
  console.log(`Y-Reach · Org profile detected: "${_orgProfile}"`);
 
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
 
  const youthCount  = (ageBuckets['0-12'] ?? 0) + (ageBuckets['13-17'] ?? 0);
  const seniorCount = ageBuckets['65+'] ?? 0;
  // Adult learner count (18–64) — primary RIEC enrollment demographic
  const adultCount  = (ageBuckets['18-24'] ?? 0) + (ageBuckets['25-64'] ?? 0);
 
  const metrics = {
    totalUnique,
    ageBuckets,
    geoImpact,
    youthAvgVisits,
    youthCount,
    seniorCount,
    adultCount,
    assistanceCount: uniqueMembers.filter(m => m.Financial_Assistance_Flag).length,
    zipCount:        Object.keys(geoImpact).length,
    zipList:         Object.keys(geoImpact).join(', '),
    hasYouth:        uniqueMembers.some(m => m.Age < 18),
    hasAdults:       uniqueMembers.some(m => m.Age >= 18 && m.Age <= 64),
    hasLowIncome:    uniqueMembers.some(m => m.Financial_Assistance_Flag),
    orgProfile:      _orgProfile,
  };
 
  console.log('Y-Reach · Analytics Complete', metrics);
 
  _metrics = metrics;
  updateKPIs(metrics);
  renderCharts(metrics);
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
async function fetchGrants(metrics) {
  document.getElementById('grants-shimmer').classList.add('hidden');
  document.getElementById('grants-empty-state').classList.add('hidden');
 
  let grants = [];
  try {
    const resp = await fetch('./grants.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    grants = await resp.json();
    console.log(`Y-Reach · ${grants.length} grants loaded from grants.json`);
 
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
 
/* ── buildFacilityTags ────────────────────────────────────────
   The facility's demographic résumé, tailored per org profile.
 
   YMCA profile:  standard youth + low-income tags.
   RIEC profile:  workforce-dev and adult-ed are elevated to
                  primary tags; youth/low-income remain if
                  applicable so general grants still surface.
 
   Think of it as two different job applicants using the same
   base CV but highlighting different skills for different
   employers — the underlying facts are identical, the
   emphasis shifts.                                           */
function buildFacilityTags(metrics) {
  const tags = [];
 
  if (metrics.orgProfile === 'riec') {
    // RIEC-first tag order — workforce tags always present
    // because RIEC's mission is workforce education by definition
    tags.push('workforce-dev');
    tags.push('adult-ed');
    tags.push('healthcare-edu');   // RIEC's CNA/EMT pipeline
 
    // Standard tags appended second so RIEC still matches
    // general low-income and youth grants where eligible
    if (metrics.hasLowIncome) tags.push('low-income');
    if (metrics.hasYouth)     tags.push('youth');
    if (metrics.hasAdults)    tags.push('community-development');
 
  } else {
    // YMCA default profile
    if (metrics.hasYouth)     tags.push('youth');
    if (metrics.hasLowIncome) tags.push('low-income');
  }
 
  return tags;
}
 
function evaluateMatches(metrics, grants) {
  const facilityTags = buildFacilityTags(metrics);
  console.log('Y-Reach · Facility tags for matching:', facilityTags);
 
  const today = new Date();
  today.setHours(0, 0, 0, 0);
 
  return grants
    .filter(g =>
      metrics.totalUnique    >= (g.min_unique_members   ?? 0) &&
      metrics.assistanceCount >= (g.min_subsidized_youth ?? 0)
    )
    .map(g => {
      const grantTags   = g.target_demographics ?? [];
      const matchedTags = grantTags.filter(t => facilityTags.includes(t));
      const demoScore   = grantTags.length > 0
        ? (matchedTags.length / grantTags.length) * 50 : 0;
 
      let urgencyScore = 0;
      if (g.deadline) {
        const daysLeft = Math.ceil((new Date(g.deadline) - today) / 86400000);
        if (daysLeft >= 0 && daysLeft <= 30) urgencyScore = 50;
        else if (daysLeft <= 90)             urgencyScore = 25;
      }
 
      return {
        ...g,
        _score:       Math.round(demoScore + urgencyScore),
        _matchedTags: matchedTags,
        _daysLeft:    g.deadline
          ? Math.ceil((new Date(g.deadline) - today) / 86400000)
          : null,
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 3);
}
 
 
/* ═══════════════════════════════════════════════════════════════
   NARRATIVE GENERATOR
═══════════════════════════════════════════════════════════════ */
function generateNarrative(metrics, grant) {
  const tags       = grant.target_demographics ?? [];
  const isYouth    = tags.includes('youth');
  const isLowInc   = tags.includes('low-income');
  const isSenior   = tags.includes('senior');
  const isHealth   = tags.includes('health-wellness');
  const isWorkforce = tags.includes('workforce-dev');
  const isHealthEdu = tags.includes('healthcare-edu');
  const isAdultEd  = tags.includes('adult-ed');
  const isRIEC     = metrics.orgProfile === 'riec';
  const isNational = grant.geographic_scope === 'national';
  const isState    = grant.geographic_scope === 'state';
 
  const fmt = (n) => n >= 1000 ? `$${(n / 1000).toFixed(0)},000` : `$${n}`;
  const amountRange = (grant.amount_min && grant.amount_max && grant.amount_min !== grant.amount_max)
    ? `${fmt(grant.amount_min)}–${fmt(grant.amount_max)}`
    : grant.amount_max ? `up to ${fmt(grant.amount_max)}` : 'the requested amount';
 
  /* ── Paragraph 1: Mission & Reach ────────────────────────── */
  const orgName = isRIEC
    ? 'The Rhode Island Education Center for H.O.P.E. (RIEC)'
    : 'our YMCA facility';
 
  const p1 = isRIEC
    ? `${orgName} is a Rhode Island-based 501(c)(3) nonprofit dedicated to creating clear, accessible pathways to sustainable employment through healthcare and workforce education. Our programming removes economic barriers to credentialing by combining tuition support, wraparound services, and employer-connected training models. During the reporting period, RIEC served ${metrics.totalUnique} unduplicated program participants across ${metrics.zipCount} zip code${metrics.zipCount !== 1 ? 's' : ''} in Rhode Island, with ${metrics.assistanceCount} individuals enrolled through our financial assistance and scholarship programs.`
    : `${orgName} serves as a cornerstone of community wellness and development, providing programming that is accessible to all residents regardless of socioeconomic background. During the reporting period, our facility served ${metrics.totalUnique} unduplicated community members spanning ${metrics.zipCount} distinct zip code${metrics.zipCount !== 1 ? 's' : ''} across our service area.`;
 
  /* ── Paragraph 2: Target-specific impact data ──────────────
     Branches on both org profile and grant tag for maximum
     relevance — RIEC grants get workforce-specific language,
     YMCA grants get the standard youth/wellness copy.        */
  let p2;
 
  if (isRIEC && (isHealthEdu || isWorkforce)) {
    p2 = `Our flagship healthcare workforce pipeline directly addresses Rhode Island's critical shortage of credentialed frontline healthcare workers. ${metrics.adultCount} of our ${metrics.totalUnique} participants are adult learners between the ages of 18 and 64 — the primary demographic for CNA, EMT, and allied health certificate programs. Of these, ${metrics.assistanceCount} receive need-based financial assistance, reflecting our commitment to making healthcare careers accessible to low-income adults who cannot absorb training costs independently. Participants are drawn from zip codes ${metrics.zipList}, communities where healthcare employment is both a documented workforce need and a pathway out of economic instability.`;
  } else if (isRIEC && isAdultEd) {
    p2 = `Adult education is the foundation of RIEC's workforce model. Our participants enter our programs at varying literacy, numeracy, and credential levels, and our wraparound approach ensures they exit with industry-recognized certifications and employer connections. Of our ${metrics.totalUnique} program participants, ${metrics.adultCount} are working-age adults (18–64) and ${metrics.assistanceCount} are supported through our financial assistance program — evidence of the income barriers our model is specifically designed to dismantle. This population spans zip codes ${metrics.zipList} across Rhode Island.`;
  } else if (isYouth && isLowInc) {
    p2 = `A core pillar of our programming is subsidized access for youth in financial need. Of our total membership, ${metrics.youthCount} members are under the age of 18, and ${metrics.assistanceCount} individuals are enrolled in our financial assistance program. Subsidized youth members averaged ${metrics.youthAvgVisits} visits per person — demonstrating sustained engagement across zip codes ${metrics.zipList}.`;
  } else if (isYouth) {
    p2 = `Youth programming is central to our mission. During the reporting period, ${metrics.youthCount} members under the age of 18 engaged with our programs, averaging ${metrics.youthAvgVisits} visits per youth member across zip codes ${metrics.zipList}.`;
  } else if (isLowInc) {
    p2 = `${metrics.assistanceCount} of our ${metrics.totalUnique} unduplicated members — ${Math.round((metrics.assistanceCount / metrics.totalUnique) * 100)}% of total reach — are enrolled in our financial assistance program, concentrated across zip codes ${metrics.zipList}.`;
  } else if (isSenior) {
    p2 = `Our senior programming addresses health, wellness, and social isolation needs. During the reporting period, ${metrics.seniorCount} members aged 65 and older participated in our programs across zip codes ${metrics.zipList}.`;
  } else {
    p2 = `Our data reflects a community-facing organization with broad reach and a strong equity commitment. Of ${metrics.totalUnique} unduplicated members, ${metrics.assistanceCount} participate through financial assistance, and our footprint covers zip codes ${metrics.zipList}.`;
  }
 
  /* ── Paragraph 3: Closing Argument ─────────────────────── */
  let p3;
 
  if (isRIEC && isNational) {
    p3 = `We respectfully request ${amountRange} through the ${grant.title} program. RIEC's model — community-rooted, employer-connected, and data-verified — is precisely the type of replicable healthcare workforce pipeline this grant is designed to scale. All impact data presented reflects verified, deduplicated enrollment records from our program management system, meeting the evidentiary standard required for federal grant reporting.`;
  } else if (isRIEC && isState) {
    p3 = `We respectfully request ${amountRange} through the ${grant.title} program. As a Rhode Island-based nonprofit with an established healthcare training infrastructure, RIEC is positioned to deploy these funds immediately. Our enrollment data — ${metrics.totalUnique} participants across ${metrics.zipCount} zip codes, with ${metrics.assistanceCount} on financial assistance — provides the granular community impact evidence that state funders require when making workforce investment decisions.`;
  } else if (isNational) {
    p3 = `We respectfully request ${amountRange} in funding through the ${grant.title} program. Our community-anchored model and data-verified reach represent the type of scalable, measurable impact this grant is designed to support. All figures are derived directly from verified, deduplicated attendance records.`;
  } else if (isState) {
    p3 = `We respectfully request ${amountRange} through the ${grant.title} program. As a Rhode Island-based nonprofit serving members across ${metrics.zipCount} zip codes, we are positioned to deploy these funds immediately into programs with demonstrated, measurable community impact.`;
  } else {
    p3 = `We respectfully request ${amountRange} in support through the ${grant.title} program. The quantitative evidence presented — ${metrics.totalUnique} unduplicated participants, ${metrics.assistanceCount} individuals on financial assistance — reflects our ongoing commitment to measurable community outcomes.`;
  }
 
  return [p1, p2, p3].join('\n\n');
}
 
 
/* ═══════════════════════════════════════════════════════════════
   GRANT CARD RENDERER
═══════════════════════════════════════════════════════════════ */
function scoreLabel(score) {
  if (score >= 75) return { text: 'High Match',   color: 'text-green-400',   bar: '#4ade80' };
  if (score >= 40) return { text: 'Medium Match', color: 'text-amber-brand', bar: '#E8A020' };
  return               { text: 'Low Match',    color: 'text-slate-400',   bar: '#475569' };
}
 
function formatAmount(min, max) {
  const fmt = n => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
  if (!min && !max) return 'Amount TBD';
  if (!min)         return `Up to ${fmt(max)}`;
  if (min === max)  return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}
 
function formatDeadline(iso) {
  if (!iso) return 'Rolling';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
 
function renderGrantCards(matches) {
  const grid = document.getElementById('grants-grid');
 
  if (!matches.length) {
    grid.innerHTML = `
      <div class="md:col-span-3 flex flex-col items-center justify-center text-center py-16
                  rounded-xl border border-dashed border-slate-border">
        <p class="font-display text-white text-lg">No qualifying grants found</p>
        <p class="font-mono text-[11px] text-slate-500 mt-2 max-w-xs">
          Your facility does not yet meet the minimum thresholds for grants in the
          current database. Try uploading a larger dataset.
        </p>
      </div>`;
    grid.classList.remove('hidden');
    return;
  }
 
  const dollarIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 flex-shrink-0"
    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879
         1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725
         0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879
         4.006 0l.415.33"/></svg>`;
 
  const calIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 flex-shrink-0"
    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5
         A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25
         2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25
         0 0121 11.25v7.5"/></svg>`;
 
  const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 flex-shrink-0"
    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166
         1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75
         0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11
         1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0
         01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057
         1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>`;
 
  grid.innerHTML = matches.map((g, cardIndex) => {
    const { text: scoreText, color: scoreColor, bar: barColor } = scoreLabel(g._score);
    const badge = (icon, content, extraClass = '') => `
      <span class="flex items-center gap-1.5 font-mono text-[11px] bg-navy
                   border border-slate-border rounded-full px-3 py-1 ${extraClass}">
        ${icon}${content}
      </span>`;
 
    const urgency = g._daysLeft !== null && g._daysLeft >= 0 && g._daysLeft <= 30
      ? ` <span class="text-red-400">· ${g._daysLeft}d left</span>` : '';
 
    const tagPills = (g.target_demographics ?? []).map(tag => {
      const isMatch = g._matchedTags.includes(tag);
      const label   = tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `<span class="font-mono text-[10px] uppercase tracking-wide rounded-full px-2.5 py-1
        ${isMatch
          ? 'bg-amber-brand/10 text-amber-brand border border-amber-brand/25'
          : 'bg-slate-border/30 text-slate-500 border border-slate-border'}">${label}</span>`;
    }).join('');
 
    return `
      <div class="grant-card rounded-xl bg-slate-card border border-slate-border p-5
                  flex flex-col gap-4">
        <div>
          <p class="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1 truncate">
            ${g.funder ?? 'Unknown Funder'}
          </p>
          <h3 class="font-display text-lg text-white leading-snug">${g.title}</h3>
        </div>
        <p class="font-body text-slate-400 text-xs leading-relaxed"
           style="-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;">
          ${g.description ?? ''}
        </p>
        <div class="flex flex-wrap gap-2">
          ${badge(dollarIcon, formatAmount(g.amount_min, g.amount_max), 'text-amber-brand')}
          ${badge(calIcon, `${formatDeadline(g.deadline)}${urgency}`, 'text-slate-300')}
        </div>
        <div class="flex flex-wrap gap-1.5">${tagPills}</div>
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
            <div class="match-bar-fill h-full"
                 style="width:0%; background-color:${barColor};"
                 data-target-width="${g._score}%"></div>
          </div>
        </div>
        <div class="flex gap-2 mt-1">
          <a href="${g.url ?? '#'}" target="_blank" rel="noopener noreferrer"
             class="btn-grant flex-1 block text-center font-mono text-xs font-medium
                    border border-amber-brand/40 text-amber-brand rounded-lg py-2.5 px-3">
            View Grant →
          </a>
          <button
            class="btn-copy-narrative flex items-center justify-center gap-1.5 font-mono
                   text-xs font-medium border border-slate-border text-slate-400
                   rounded-lg py-2.5 px-3 flex-1 transition-colors duration-200
                   hover:border-amber-brand/40 hover:text-amber-brand"
            data-card-index="${cardIndex}">
            ${copyIcon}
            <span class="btn-copy-label">Copy Draft Narrative</span>
          </button>
        </div>
      </div>`;
  }).join('');
 
  grid._matches = matches;
  grid.classList.remove('hidden');
 
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      grid.querySelectorAll('.match-bar-fill[data-target-width]').forEach(bar => {
        bar.style.width = bar.dataset.targetWidth;
      });
    });
  });
 
  grid.addEventListener('click', handleCopyClick);
}
 
/* ── handleCopyClick ─────────────────────────────────────────── */
async function handleCopyClick(e) {
  const btn = e.target.closest('.btn-copy-narrative');
  if (!btn || !_metrics) return;
 
  const grant = document.getElementById('grants-grid')._matches?.[parseInt(btn.dataset.cardIndex, 10)];
  if (!grant) return;
 
  const narrative = generateNarrative(_metrics, grant);
  const label     = btn.querySelector('.btn-copy-label');
 
  try {
    await navigator.clipboard.writeText(narrative);
    label.textContent = 'Copied!';
    btn.classList.replace('text-slate-400', 'text-green-400');
    btn.classList.replace('border-slate-border', 'border-green-700/40');
    setTimeout(() => {
      label.textContent = 'Copy Draft Narrative';
      btn.classList.replace('text-green-400', 'text-slate-400');
      btn.classList.replace('border-green-700/40', 'border-slate-border');
    }, 2000);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), {
      value: narrative, style: 'position:fixed;opacity:0;'
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    label.textContent = 'Copied!';
    setTimeout(() => { label.textContent = 'Copy Draft Narrative'; }, 2000);
  }
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
      analyseData(results.data, file);   // ← pass file for profile detection
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
 
/* ── Status pill ─────────────────────────────────────────────── */
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
