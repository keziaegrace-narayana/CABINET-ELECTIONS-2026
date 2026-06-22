/* ============================================================
   results.js — Narayana Techno Schools Cabinet Elections 2026–27
   Election Results Landing Page
   ============================================================ */

// ── CONFIGURATION ─────────────────────────────────────────────
// Set the deployed Google Apps Script Web App URL in site-config.js.
const RESULTS_CONFIG = {
  SCRIPT_URL: (window.ELECTION_SITE_CONFIG && window.ELECTION_SITE_CONFIG.SCRIPT_URL) || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec',
  REFRESH_INTERVAL_MS: 30000,
  POSITIONS: [
    'Head Boy',
    'Head Girl',
    'Sports Captain',
    'Sports Deputy Captain',
    'Cyber Sentinel',
    'Deputy Cyber Sentinel',
  ],
  BRANCHES: [
    'Banashankari', 'Banaswadi', 'Bannerghatta', 'Basavanagudi', 'Begur', 'Bellandur',
    'Bommanahalli', 'BTM Layout', 'Chikkabanavara', 'CV Raman Nagar', 'Devanahalli',
    'Doddaballapur', 'Domlur', 'Electronic City', 'Gandhinagar', 'Gottigere',
    'HBR Layout', 'Hebbal', 'Horamavu', 'Hoskote', 'HSR Layout', 'Hulimavu',
    'Indiranagar', 'JP Nagar', 'Jayanagar', 'Kaggadasapura', 'Kammanahalli',
    'Kanakapura Road', 'Kengeri', 'Konanakunte', 'Koramangala', 'KR Puram',
    'Krishnarajapuram', 'Mahadevapura', 'Malleshwaram', 'Marathahalli', 'Nagarbhavi',
    'Old Madras Road', 'Padmanabhanagar', 'Peenya', 'Rajajinagar', 'Rammurthy Nagar',
    'RT Nagar', 'Sahakara Nagar', 'Sarjapur Road', 'Shivajinagar', 'Talaghattapura',
    'Tumkur Road', 'Uttarahalli', 'Vasanth Nagar', 'Vijayanagar', 'Virgonagar',
    'Whitefield', 'Yelahanka', 'Yeshwanthpur',
  ],
};

// ── STATE ──────────────────────────────────────────────────────
const rState = {
  password:             '',
  stats:                null,
  allVotes:             [],
  branchPositionResults: {},
  selectedBranch:       '',
  isLocked:             false,
  branchChart:          null,
  distChart:            null,
  refreshTimer:         null,
};

// ── CHART THEME ────────────────────────────────────────────────
Chart.defaults.font.family = "'Outfit', system-ui, sans-serif";
Chart.defaults.color        = '#5A6382';

const CHART_COLORS = [
  '#1D3557','#2E5A9E','#E76F24','#156D45','#8B5E3C','#5A6382',
  '#4A90D9','#CF601B','#1A7A4D','#BF9000','#7B4FAA','#C0392B',
];

// ── POSITION ICONS (SVG) ───────────────────────────────────────
const POSITION_ICONS = {
  'Head Boy': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.5 7H22l-6 4.5 2.5 7L12 17l-6.5 3.5L8 13 2 8.5h7.5L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  'Head Girl': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M15 5l2-2M9 5L7 3M12 4V2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  'Sports Captain': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 3c-2.5 2.5-2.5 5.5 0 9 2.5 3.5 2.5 6.5 0 9" stroke="currentColor" stroke-width="1.2"/><path d="M3 12h18M5.5 7.5h13M5.5 16.5h13" stroke="currentColor" stroke-width="1.2"/></svg>`,
  'Sports Deputy Captain': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 1.5"/><path d="M12 3c-2.5 2.5-2.5 5.5 0 9 2.5 3.5 2.5 6.5 0 9" stroke="currentColor" stroke-width="1.2"/><path d="M3 12h18" stroke="currentColor" stroke-width="1.2"/></svg>`,
  'Cyber Sentinel': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V7L12 3z" stroke="currentColor" stroke-width="1.5"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'Deputy Cyber Sentinel': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v5c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V7L12 3z" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/></svg>`,
};

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('refreshBtn').addEventListener('click', loadResults);
  document.getElementById('branchFilter').addEventListener('change', handleBranchFilterChange);
});
function handleBranchFilterChange() {
  rState.selectedBranch = document.getElementById('branchFilter').value;
  renderResults();
}

function populateBranchFilter() {
  const select = document.getElementById('branchFilter');
  const branchNames = RESULTS_CONFIG.BRANCHES.slice().sort((a,b) => a.localeCompare(b, 'en-IN'));
  const currentValue = select.value || '';

  select.innerHTML = '<option value="">All Branches</option>' +
    branchNames.map(branch => `
      <option value="${escHtml(branch)}">${escHtml(branch)}</option>
    `).join('');

  if (currentValue && branchNames.includes(currentValue)) {
    select.value = currentValue;
  } else {
    rState.selectedBranch = '';
  }
}
// ── AUTH ───────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const pwd   = document.getElementById('resultPassword').value.trim();
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');

  if (!pwd) { errEl.textContent = 'Password is required.'; return; }
  errEl.textContent = '';
  setButtonLoading(btn, true);

  try {
    const url  = `${RESULTS_CONFIG.SCRIPT_URL}?action=getStats&pwd=${encodeURIComponent(pwd)}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      errEl.textContent = data.error === 'Unauthorized.' ? 'Incorrect password.' : (data.error || 'Login failed.');
      return;
    }

    rState.password = pwd;
    rState.stats    = data;
    rState.isLocked = data.locked;

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('resultsDashboard').classList.remove('hidden');

    populateBranchFilter();
    renderResults();
    startAutoRefresh();

  } catch (err) {
    if (RESULTS_CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID_HERE') && pwd === 'admin') {
      rState.password = pwd;
      rState.stats    = {
        totalVotes: 0, branchStats: {}, positionResults: {},
        locked: false, lastVote: null,
      };
      rState.isLocked = false;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('resultsDashboard').classList.remove('hidden');
      renderResults();
      showResultsAlert('warning', 'Demo mode: Google Sheets not connected. Configure SCRIPT_URL in results.js to enable live data.');
      startAutoRefresh();
    } else {
      errEl.textContent = `Connection error: ${err.message}`;
    }
  } finally {
    setButtonLoading(btn, false);
  }
}

function handleLogout() {
  stopAutoRefresh();
  rState.password = '';
  rState.stats    = null;
  document.getElementById('resultPassword').value = '';
  document.getElementById('resultsDashboard').classList.add('hidden');
  document.getElementById('loginScreen').style.display = '';
  destroyCharts();
}

// ── LOAD RESULTS ───────────────────────────────────────────────
async function loadResults() {
  if (!rState.password) return;

  try {
    const url  = `${RESULTS_CONFIG.SCRIPT_URL}?action=getStats&pwd=${encodeURIComponent(rState.password)}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Refresh failed.');

    rState.stats    = data;
    rState.isLocked = data.locked;
    populateBranchFilter();
    renderResults();

    document.getElementById('lastUpdatedLabel').innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#8E96B0" stroke-width="1.2"/><path d="M6.5 3.5v3.3l2 1.2" stroke="#8E96B0" stroke-width="1.2" stroke-linecap="round"/></svg>
      Updated ${new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
    `;
    hideResultsAlert();

  } catch (err) {
    if (!RESULTS_CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID_HERE')) {
      showResultsAlert('error', `Refresh failed: ${err.message}`);
    }
  }
}

// ── RENDER ─────────────────────────────────────────────────────
function renderResults() {
  renderBanner();
  renderStats();
  renderWinners();
  renderCharts();
}

function renderBanner() {
  const badge = document.getElementById('resultsStatusBadge');
  const text  = document.getElementById('resultsStatusText');
  if (rState.isLocked) {
    badge.className = 'results-status-badge concluded';
    text.textContent = 'Election Concluded';
  } else {
    badge.className = 'results-status-badge open';
    text.textContent = 'Voting in Progress';
  }
}

function renderStats() {
  const s = rState.stats;
  if (!s) return;
  const branches = Object.keys(s.branchStats || {}).length;
  document.getElementById('rStatTotal').textContent    = (s.totalVotes || 0).toLocaleString();
  document.getElementById('rStatBranches').textContent = branches;

  if (s.lastVote) {
    const d = new Date(s.lastVote);
    document.getElementById('rStatLastVote').textContent = isNaN(d)
      ? '—'
      : d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  } else {
    document.getElementById('rStatLastVote').textContent = '—';
  }
}

function renderWinners() {
  const s         = rState.stats;
  const container = document.getElementById('resultsWinnersShowcase');
  const branch    = rState.selectedBranch;
  const source    = branch
    ? (s.branchPositionResults?.[branch] ? s.branchPositionResults[branch] : {})
    : s.positionResults;

  if (!s || !source || s.totalVotes === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1; padding:48px 0;">
        <div class="empty-state-title">No votes recorded yet</div>
        <div class="empty-state-desc">Results will appear here once voting begins.</div>
      </div>`;
    return;
  }

  container.innerHTML = RESULTS_CONFIG.POSITIONS.map(pos => {
    const candidates = source[pos] || {};
    let winner = '—', topVotes = 0;
    Object.entries(candidates).forEach(([name, count]) => {
      if (count > topVotes) { topVotes = count; winner = name; }
    });

    const hasVotes  = topVotes > 0;
    const iconSvg   = POSITION_ICONS[pos] || '';

    return `
      <div class="results-winner-card ${hasVotes ? 'crowned' : ''}">
        <div class="results-winner-icon">${iconSvg}</div>
        <span class="results-winner-position-label">${pos}</span>
        <span class="results-winner-name">${escHtml(winner)}</span>
        ${hasVotes
          ? `<span class="results-winner-votes"><strong>${topVotes}</strong> vote${topVotes === 1 ? '' : 's'}</span>`
          : `<span class="results-winner-votes">No votes yet</span>`}
      </div>`;
  }).join('');
}

// ── CHARTS ─────────────────────────────────────────────────────
function renderCharts() {
  const s           = rState.stats;
  const branchStats = s ? s.branchStats || {} : {};
  const sorted      = Object.entries(branchStats).sort((a,b) => b[1]-a[1]);

  // Branch bar chart
  const branchCtx = document.getElementById('branchChart');
  destroyChart('branchChart');
  const top15 = sorted.slice(0, 15);

  if (top15.length > 0) {
    rState.branchChart = new Chart(branchCtx, {
      type: 'bar',
      data: {
        labels:   top15.map(([b]) => b.length > 14 ? b.slice(0,14)+'…' : b),
        datasets: [{
          label:           'Votes',
          data:            top15.map(([,v]) => v),
          backgroundColor: CHART_COLORS[0],
          borderRadius:    4,
          borderSkipped:   false,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend:  { display: false },
          tooltip: { callbacks: { label: c => ` ${c.raw} votes` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: '#E0E4F0' }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
      },
    });
  } else {
    branchCtx.parentElement.innerHTML = `<div class="empty-state"><div class="empty-state-title">No votes yet</div></div>`;
  }

  // Doughnut distribution chart
  const distCtx = document.getElementById('distChart');
  destroyChart('distChart');
  const top10 = sorted.slice(0, 10);

  if (top10.length > 0) {
    rState.distChart = new Chart(distCtx, {
      type: 'doughnut',
      data: {
        labels:   top10.map(([b]) => b),
        datasets: [{
          data:            top10.map(([,v]) => v),
          backgroundColor: CHART_COLORS,
          borderWidth:     2,
          borderColor:     '#fff',
          hoverOffset:     6,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '60%',
        plugins: {
          legend: {
            position: 'right',
            labels:   { font: { size: 11 }, padding: 12, boxWidth: 12 },
          },
          tooltip: {
            callbacks: {
              label: c => {
                const total = c.dataset.data.reduce((a,b) => a+b, 0);
                return ` ${c.raw} votes (${total > 0 ? ((c.raw/total)*100).toFixed(1) : 0}%)`;
              },
            },
          },
        },
      },
    });
  } else {
    distCtx.parentElement.innerHTML = `<div class="empty-state"><div class="empty-state-title">No votes yet</div></div>`;
  }
}

function destroyChart(id) {
  const key = id === 'branchChart' ? 'branchChart' : 'distChart';
  if (rState[key]) { rState[key].destroy(); rState[key] = null; }
}

function destroyCharts() {
  destroyChart('branchChart');
  destroyChart('distChart');
}

// ── AUTO-REFRESH ───────────────────────────────────────────────
function startAutoRefresh() {
  stopAutoRefresh();
  rState.refreshTimer = setInterval(loadResults, RESULTS_CONFIG.REFRESH_INTERVAL_MS);
  loadResults();
}

function stopAutoRefresh() {
  if (rState.refreshTimer) { clearInterval(rState.refreshTimer); rState.refreshTimer = null; }
}

// ── UTILITIES ──────────────────────────────────────────────────
function showResultsAlert(type, msg) {
  const el = document.getElementById('resultsAlert');
  el.textContent = msg;
  el.className   = `alert alert-${type}`;
}

function hideResultsAlert() {
  const el = document.getElementById('resultsAlert');
  el.className = 'alert hidden';
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled  = loading;
  if (text)    text.classList.toggle('hidden', loading);
  if (spinner) spinner.classList.toggle('hidden', !loading);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}
