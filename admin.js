/* ============================================================
   admin.js — Narayana Schools Cabinet Elections 2026–27
   Administrator Dashboard (localStorage-based)
   ============================================================ */

// ── CONFIGURATION ─────────────────────────────────────────────
const ADMIN_CONFIG = {
  REFRESH_INTERVAL_MS: 10000,   // Auto-refresh every 10 seconds
  POSITIONS: [
    'Head Boy',
    'Head Girl',
    'Sports Captain',
    'Sports Deputy Captain',
    'Cyber Sentinel',
    'Deputy Cyber Sentinel',
  ],
};

// ── STATE ──────────────────────────────────────────────────────
const adminState = {
  adminPassword:   'Narayana@Admin2026',
  allVotes:        [],
  stats:           null,
  isLocked:        false,
  refreshTimer:    null,
  branchChart:     null,
  distChart:       null,
  filteredVotes:   [],
  currentBranch:   '',
};

// ── CHART THEME ────────────────────────────────────────────────
Chart.defaults.font.family = "'Outfit', system-ui, sans-serif";
Chart.defaults.color        = '#5A6382';

const CHART_COLORS = [
  '#1D3557','#2E5A9E','#E76F24','#156D45','#8B5E3C','#5A6382',
  '#4A90D9','#CF601B','#1A7A4D','#BF9000','#7B4FAA','#C0392B',
];

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('refreshBtn').addEventListener('click', () => loadDashboard());
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
  document.getElementById('lockBtn').addEventListener('click', () => handleLockToggle(true));
  document.getElementById('unlockBtn').addEventListener('click', () => handleLockToggle(false));
  document.getElementById('resetBtn').addEventListener('click', () => showModal('resetModal'));
  document.getElementById('cancelResetBtn').addEventListener('click', () => hideModal('resetModal'));
  document.getElementById('confirmResetBtn').addEventListener('click', handleResetElection);
  document.getElementById('branchResultFilter').addEventListener('change', renderBranchTable);
  document.getElementById('branchPositionFilter').addEventListener('change', renderBranchTable);
  document.getElementById('positionFilter').addEventListener('change', renderPositionTable);
  document.getElementById('voteSearch').addEventListener('input', renderVotesTable);
  document.getElementById('voteBranchFilter').addEventListener('change', renderVotesTable);
  
  // Add branch selector and backup buttons
  const adminControls = document.querySelector('.admin-controls');
  if (adminControls) {
    adminControls.insertAdjacentHTML('beforeend', `
      <div style="display:flex; gap:8px; align-items:center;">
        <div class="select-wrapper" style="width:200px;">
          <select id="adminBranchSelect" class="form-control" style="height:36px; font-size:13px;">
            <option value="">Select Branch for Voting...</option>
          </select>
          <span class="select-arrow" style="right:8px;">
            <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
          </span>
        </div>
        <button class="btn btn-secondary btn-sm" id="backupBtn" title="Backup votes to file">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 10v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="#5A6382" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Backup
        </button>
        <button class="btn btn-secondary btn-sm" id="restoreBtn" title="Restore votes from file">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 6v4a1 1 0 001 1h8a1 1 0 001-1V6M7 10V2M4 5l3-3 3 3" stroke="#5A6382" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Restore
        </button>
      </div>
    `);
    
    document.getElementById('backupBtn').addEventListener('click', backupData);
    document.getElementById('restoreBtn').addEventListener('click', () => document.getElementById('restoreFileInput').click());
  }
  
  // Hidden file input for restore
  if (!document.getElementById('restoreFileInput')) {
    document.body.insertAdjacentHTML('beforeend', '<input type="file" id="restoreFileInput" accept=".json" style="display:none;">');
    document.getElementById('restoreFileInput').addEventListener('change', handleRestoreFile);
  }
});

// ── AUTH ───────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const pwd     = document.getElementById('adminPassword').value.trim();
  const errEl   = document.getElementById('loginError');
  const btn     = document.getElementById('loginBtn');

  if (!pwd) { errEl.textContent = 'Password is required.'; return; }
  if (pwd !== 'Narayana@Admin2026') {
    errEl.textContent = 'Incorrect password.';
    return;
  }

  errEl.textContent = '';
  setButtonLoading(btn, true);

  try {
    adminState.adminPassword = pwd;
    
    // Load data from localStorage
    const votes = StorageService.getVotes();
    const settings = StorageService.getSettings();
    
    adminState.allVotes  = votes;
    adminState.isLocked  = settings.locked || false;
    
    document.getElementById('loginScreen').style.display   = 'none';
    document.getElementById('adminDashboard').classList.add('visible');

    populateBranchSelector();
    processAndRender();
    startAutoRefresh();

  } catch (err) {
    errEl.textContent = `Error: ${err.message}`;
  } finally {
    setButtonLoading(btn, false);
  }
}

function handleLogout() {
  stopAutoRefresh();
  adminState.adminPassword = '';
  adminState.allVotes      = [];
  adminState.stats         = null;
  document.getElementById('adminPassword').value = '';
  document.getElementById('adminDashboard').classList.remove('visible');
  document.getElementById('loginScreen').style.display = '';
  destroyCharts();
}

// ── BRANCH SELECTOR ────────────────────────────────────────────
function populateBranchSelector() {
  const selector = document.getElementById('adminBranchSelect');
  if (!selector) return;
  
  const branches = [...new Set(adminState.allVotes.map(v => v.branch || ''))].filter(Boolean).sort();
  
  selector.innerHTML = '<option value="">Select Branch for Voting...</option>' +
    branches.map(b => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join('');
  
  selector.addEventListener('change', (e) => {
    adminState.currentBranch = e.target.value;
    const settings = StorageService.getSettings();
    settings.currentBranch = adminState.currentBranch;
    StorageService.setSettings(settings);
    showAdminAlert('success', `Branch set to: ${adminState.currentBranch || 'None'}`);
    setTimeout(hideAdminAlert, 2000);
  });
}

// ── LOAD DASHBOARD ─────────────────────────────────────────────
function loadDashboard() {
  try {
    const votes = StorageService.getVotes();
    const settings = StorageService.getSettings();
    
    adminState.allVotes  = votes;
    adminState.isLocked  = settings.locked || false;
    
    processAndRender();

    // Update last-refreshed timestamp
    document.getElementById('lastUpdatedLabel').innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#8E96B0" stroke-width="1.2"/><path d="M6.5 3.5v3.3l2 1.2" stroke="#8E96B0" stroke-width="1.3"/></svg>
      Updated ${new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
    `;
    hideAdminAlert();

  } catch (err) {
    showAdminAlert('error', `Refresh failed: ${err.message}`);
  }
}

function processAndRender() {
  computeStats();
  renderDashboard();
}

// ── COMPUTE STATS ──────────────────────────────────────────────
function computeStats() {
  const votes = adminState.allVotes;
  const positionResults = {};
  const branchStats = {};

  // Initialize positions
  ADMIN_CONFIG.POSITIONS.forEach(pos => {
    positionResults[pos] = {};
  });

  // Count votes
  votes.forEach(vote => {
    const branch = vote.branch || '';
    branchStats[branch] = (branchStats[branch] || 0) + 1;

    ADMIN_CONFIG.POSITIONS.forEach(pos => {
      const candidate = vote.votes && vote.votes[pos];
      if (candidate) {
        positionResults[pos][candidate] = (positionResults[pos][candidate] || 0) + 1;
      }
    });
  });

  adminState.stats = {
    totalVotes: votes.length,
    branchStats,
    positionResults,
    locked: adminState.isLocked,
    lastVote: votes.length > 0 ? votes[votes.length - 1].timestamp : null,
  };
}

// ── RENDER DASHBOARD ───────────────────────────────────────────
function renderDashboard() {
  renderStatCards();
  renderBranchChart();
  renderDistributionChart();
  populateBranchResultFilter();
  renderBranchTable();
  renderPositionTable();
  populateBranchFilter();
  renderVotesTable();
  updateLockButtons();
  updateElectionStatus();
}

function renderStatCards() {
  const stats = adminState.stats;
  if (!stats) return;

  const total    = stats.totalVotes || 0;
  const branches = Object.keys(stats.branchStats || {});
  const active   = branches.length;

  // Leading branch
  let leadBranch = '—', leadVotes = 0;
  branches.forEach(b => {
    if ((stats.branchStats[b] || 0) > leadVotes) {
      leadVotes  = stats.branchStats[b];
      leadBranch = b;
    }
  });

  document.getElementById('statTotalVotes').textContent      = total.toLocaleString();
  document.getElementById('statActiveBranches').textContent  = active;
  document.getElementById('statLeadingBranch').textContent   = leadBranch;
  document.getElementById('statLeadingBranchVotes').textContent = leadVotes > 0 ? `${leadVotes} votes` : '—';

  // Last vote
  const lastVote = stats.lastVote;
  if (lastVote) {
    const d = new Date(lastVote);
    document.getElementById('statLastVote').textContent = isNaN(d) ? '—' : d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    document.getElementById('lastVoteTimestamp').textContent = `Last vote: ${isNaN(d) ? '—' : d.toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })}`;
  } else {
    document.getElementById('statLastVote').textContent = '—';
    document.getElementById('lastVoteTimestamp').textContent = 'No votes recorded yet';
  }
}

// ── CHARTS ─────────────────────────────────────────────────────
function renderBranchChart() {
  const stats = adminState.stats;
  const ctx   = document.getElementById('branchChart');
  if (!ctx) return;

  const branchStats = stats ? stats.branchStats || {} : {};
  const sorted      = Object.entries(branchStats).sort((a,b) => b[1]-a[1]).slice(0, 15);

  destroyChart('branchChart');

  if (sorted.length === 0) {
    ctx.parentElement.innerHTML = `<div class="empty-state"><div class="empty-state-title">No votes yet</div></div>`;
    return;
  }

  adminState.branchChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   sorted.map(([b]) => b.length > 14 ? b.slice(0,14)+'…' : b),
      datasets: [{
        label:           'Votes',
        data:            sorted.map(([,v]) => v),
        backgroundColor: CHART_COLORS[0],
        borderRadius:    4,
        borderSkipped:   false,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw} votes` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#E0E4F0' }, ticks: { stepSize: 1, font: { size: 11 } } },
      },
    },
  });
}

function renderDistributionChart() {
  const stats = adminState.stats;
  const ctx   = document.getElementById('distributionChart');
  if (!ctx) return;

  const branchStats = stats ? stats.branchStats || {} : {};
  const sorted      = Object.entries(branchStats).sort((a,b) => b[1]-a[1]).slice(0, 10);

  destroyChart('distributionChart');

  if (sorted.length === 0) {
    ctx.parentElement.innerHTML = `<div class="empty-state"><div class="empty-state-title">No votes yet</div></div>`;
    return;
  }

  adminState.distChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   sorted.map(([b]) => b),
      datasets: [{
        data:            sorted.map(([,v]) => v),
        backgroundColor: CHART_COLORS,
        borderWidth:     2,
        borderColor:     '#fff',
        hoverBorderColor:'#fff',
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
            label: ctx => {
              const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
              const pct   = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
              return ` ${ctx.raw} votes (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function destroyChart(canvasId) {
  const key = canvasId === 'branchChart' ? 'branchChart' : 'distChart';
  if (adminState[key]) { adminState[key].destroy(); adminState[key] = null; }
}

function destroyCharts() {
  destroyChart('branchChart');
  destroyChart('distChart');
}

// ── TABLES ─────────────────────────────────────────────────────
function renderBranchTable() {
  const tbody          = document.getElementById('branchTableBody');
  const branchFilter   = document.getElementById('branchResultFilter').value;
  const positionFilter = document.getElementById('branchPositionFilter').value;
  const votes          = adminState.allVotes || [];

  if (votes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:32px 0;"><div class="empty-state-title">No votes recorded yet</div></div></td></tr>`;
    return;
  }

  const rows = [];
  const branchNames = getBranchNames(votes).filter(branch => !branchFilter || branch === branchFilter);
  const positions = positionFilter ? [positionFilter] : ADMIN_CONFIG.POSITIONS;

  branchNames.forEach(branch => {
    const branchVotes = votes.filter(v => (v.branch || '') === branch);

    positions.forEach(position => {
      const counts = {};
      branchVotes.forEach(v => {
        const candidate = v.votes && v.votes[position];
        if (candidate) counts[candidate] = (counts[candidate] || 0) + 1;
      });

      const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
      const total  = sorted.reduce((sum, [,count]) => sum + count, 0);

      sorted.forEach(([candidate, count], i) => {
        rows.push({
          branch,
          position,
          rank: i + 1,
          candidate,
          votes: count,
          pct: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0',
        });
      });
    });
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:24px 0;"><div class="empty-state-title">No matching results</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${escHtml(r.branch)}</strong></td>
      <td><span class="badge badge-navy">${escHtml(r.position)}</span></td>
      <td class="rank-cell rank-${r.rank}">${r.rank === 1 ? '1st' : r.rank === 2 ? '2nd' : r.rank === 3 ? '3rd' : `${r.rank}th`}</td>
      <td>${escHtml(r.candidate)}</td>
      <td><span class="badge ${r.rank === 1 ? 'badge-orange' : 'badge-subtle'}">${r.votes}</span></td>
      <td>
        <div class="vote-bar-row">
          <div class="vote-bar"><div class="vote-bar-inner" style="width:${r.pct}%"></div></div>
          <span class="vote-count-num">${r.pct}%</span>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPositionTable() {
  const stats  = adminState.stats;
  const tbody  = document.getElementById('positionTableBody');
  const filter = document.getElementById('positionFilter').value;

  if (!stats || !stats.positionResults) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="padding:24px 0;"><div class="empty-state-title">No votes yet</div></div></td></tr>`;
    return;
  }

  const rows = [];
  const positions = filter ? [filter] : ADMIN_CONFIG.POSITIONS;

  positions.forEach(pos => {
    const candidates = stats.positionResults[pos] || {};
    const sorted     = Object.entries(candidates).sort((a,b) => b[1]-a[1]);
    const total      = sorted.reduce((acc, [,v]) => acc + v, 0);

    sorted.forEach(([name, votes], i) => {
      const pct = total > 0 ? ((votes / total) * 100).toFixed(1) : '0.0';
      rows.push({ rank: i+1, position: pos, name, votes, pct });
    });
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="padding:24px 0;"><div class="empty-state-title">No votes yet</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><span class="badge badge-navy">${escHtml(r.position)}</span></td>
      <td>${escHtml(r.name)}</td>
      <td><span class="badge ${r.rank === 1 ? 'badge-orange' : 'badge-subtle'}">${r.votes}</span></td>
      <td>
        <div class="vote-bar-row">
          <div class="vote-bar"><div class="vote-bar-inner" style="width:${r.pct}%"></div></div>
          <span class="vote-count-num">${r.pct}%</span>
        </div>
      </td>
    </tr>
  `).join('');
}

function populateBranchResultFilter() {
  const sel = document.getElementById('branchResultFilter');
  const currentValue = sel.value || '';
  const branches = getBranchNames(adminState.allVotes);
  const options = branches
    .map(b => `<option value="${escHtml(b)}">${escHtml(b)}</option>`)
    .join('');

  sel.innerHTML = `<option value="">All Branches</option>${options}`;
  if (currentValue && branches.includes(currentValue)) {
    sel.value = currentValue;
  }
}

function getBranchNames(votes) {
  return [...new Set((votes || []).map(v => v.branch || '').filter(Boolean))].sort();
}

function populateBranchFilter() {
  const sel = document.getElementById('voteBranchFilter');
  const currentValue = sel.value || '';
  const branches = getBranchNames(adminState.allVotes);
  const options = branches
    .map(b => `<option value="${escHtml(b)}">${escHtml(b)}</option>`)
    .join('');

  sel.innerHTML = `<option value="">All Branches</option>${options}`;
  if (currentValue && branches.includes(currentValue)) {
    sel.value = currentValue;
  }
}

function renderVotesTable() {
  const tbody      = document.getElementById('votesTableBody');
  const q          = (document.getElementById('voteSearch').value || '').toLowerCase();
  const branchFilt = document.getElementById('voteBranchFilter').value;

  let votes = adminState.allVotes;
  if (!votes || votes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state" style="padding:32px 0;"><div class="empty-state-title">No votes recorded yet</div></div></td></tr>`;
    document.getElementById('voteLogCount').textContent = 'Complete vote record — 0 entries';
    return;
  }

  // Apply filters
  if (q) {
    votes = votes.filter(v => {
      const name  = (v.name || '').toLowerCase();
      const admno = (v.admissionNo || '').toLowerCase();
      return name.includes(q) || admno.includes(q);
    });
  }
  if (branchFilt) {
    votes = votes.filter(v => (v.branch || '') === branchFilt);
  }

  adminState.filteredVotes = votes;
  document.getElementById('voteLogCount').textContent = `Complete vote record — ${votes.length} entries`;

  // Reverse so latest first
  const display = [...votes].reverse();

  tbody.innerHTML = display.slice(0, 500).map((v, i) => {
    const ts    = v.timestamp ? new Date(v.timestamp).toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' }) : '—';
    return `
      <tr>
        <td>${display.length - i}</td>
        <td style="white-space:nowrap; font-size:11.5px; color:var(--subtle);">${ts}</td>
        <td>${escHtml(v.name || '—')}</td>
        <td><code style="font-size:12px;">${escHtml(v.admissionNo || '—')}</code></td>
        <td><span class="badge badge-navy">${escHtml(v.branch || '—')}</span></td>
        <td style="font-size:12px;">${escHtml((v.votes && v.votes['Head Boy']) || '—')}</td>
        <td style="font-size:12px;">${escHtml((v.votes && v.votes['Head Girl']) || '—')}</td>
        <td style="font-size:12px;">${escHtml((v.votes && v.votes['Sports Captain']) || '—')}</td>
        <td style="font-size:12px;">${escHtml((v.votes && v.votes['Sports Deputy Captain']) || '—')}</td>
        <td style="font-size:12px;">${escHtml((v.votes && v.votes['Cyber Sentinel']) || '—')}</td>
        <td style="font-size:12px;">${escHtml((v.votes && v.votes['Deputy Cyber Sentinel']) || '—')}</td>
      </tr>
    `;
  }).join('');
}

// ── LOCK / UNLOCK ──────────────────────────────────────────────
function handleLockToggle(lock) {
  const label  = lock ? 'lock' : 'unlock';

  if (!confirm(`Are you sure you want to ${label} voting?`)) return;

  try {
    const settings = StorageService.getSettings();
    settings.locked = lock;
    StorageService.setSettings(settings);
    
    adminState.isLocked = lock;
    updateLockButtons();
    updateElectionStatus();
    showAdminAlert('success', `Voting has been ${lock ? 'locked' : 'unlocked'} successfully.`);
    setTimeout(hideAdminAlert, 3000);

  } catch (err) {
    showAdminAlert('error', `Failed to ${label} voting: ${err.message}`);
  }
}

function updateLockButtons() {
  document.getElementById('lockBtn').style.display   = adminState.isLocked ? 'none' : '';
  document.getElementById('unlockBtn').style.display = adminState.isLocked ? '' : 'none';
}

function updateElectionStatus() {
  const el = document.getElementById('electionStatusValue');
  if (adminState.isLocked) {
    el.textContent  = 'Locked — Voting Closed';
    el.className    = 'election-status-value locked';
  } else {
    el.textContent  = 'Open — Accepting Votes';
    el.className    = 'election-status-value open';
  }
}

// ── RESET ──────────────────────────────────────────────────────
function handleResetElection() {
  const btn      = document.getElementById('confirmResetBtn');
  const alertEl  = document.getElementById('resetModalAlert');
  setButtonLoading(btn, true);

  try {
    StorageService.resetVotes();
    StorageService.resetVotedStudents();
    
    adminState.allVotes = [];
    computeStats();
    hideModal('resetModal');
    renderDashboard();
    showAdminAlert('success', 'Election has been reset. All votes have been deleted.');
    setTimeout(hideAdminAlert, 4000);

  } catch (err) {
    alertEl.textContent = `Reset failed: ${err.message}`;
    alertEl.className   = 'alert alert-error';
  } finally {
    setButtonLoading(btn, false);
  }
}

// ── CSV EXPORT ─────────────────────────────────────────────────
function exportCSV() {
  const votes = adminState.allVotes;
  if (!votes || votes.length === 0) {
    showAdminAlert('warning', 'No votes to export.');
    return;
  }

  const headers = [
    'Timestamp','Student Name','Admission Number','Branch',
    'Head Boy','Head Girl','Sports Captain','Sports Deputy Captain',
    'Cyber Sentinel','Deputy Cyber Sentinel',
  ];

  const csvRows = [headers.join(',')];
  votes.forEach(v => {
    const row = [
      v.timestamp || '',
      v.name || '',
      v.admissionNo || '',
      v.branch || '',
      (v.votes && v.votes['Head Boy']) || '',
      (v.votes && v.votes['Head Girl']) || '',
      (v.votes && v.votes['Sports Captain']) || '',
      (v.votes && v.votes['Sports Deputy Captain']) || '',
      (v.votes && v.votes['Cyber Sentinel']) || '',
      (v.votes && v.votes['Deputy Cyber Sentinel']) || '',
    ].map(val => `"${String(val).replace(/"/g, '""')}"`);
    csvRows.push(row.join(','));
  });

  const csv      = csvRows.join('\n');
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const link     = document.createElement('a');
  const filename = `NTS_Elections_Votes_${new Date().toISOString().slice(0,10)}.csv`;

  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  
  showAdminAlert('success', 'Votes exported successfully!');
  setTimeout(hideAdminAlert, 2000);
}

// ── BACKUP / RESTORE ──────────────────────────────────────────
function backupData() {
  const data = StorageService.exportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `NTS_Elections_Backup_${new Date().toISOString().slice(0,10)}.json`;

  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  
  showAdminAlert('success', 'Data backed up successfully!');
  setTimeout(hideAdminAlert, 2000);
}

function handleRestoreFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.votes || !Array.isArray(data.votes)) {
        throw new Error('Invalid backup file format.');
      }

      if (!confirm('This will overwrite all current data. Continue?')) return;

      StorageService.importData(data);
      adminState.allVotes = data.votes || [];
      computeStats();
      renderDashboard();
      
      showAdminAlert('success', 'Data restored successfully!');
      setTimeout(hideAdminAlert, 3000);

    } catch (err) {
      showAdminAlert('error', `Restore failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
  
  // Reset file input
  e.target.value = '';
}

// ── AUTO-REFRESH ───────────────────────────────────────────────
function startAutoRefresh() {
  stopAutoRefresh();
  adminState.refreshTimer = setInterval(loadDashboard, ADMIN_CONFIG.REFRESH_INTERVAL_MS);
  loadDashboard();
}

function stopAutoRefresh() {
  if (adminState.refreshTimer) { clearInterval(adminState.refreshTimer); adminState.refreshTimer = null; }
}

// ── MODAL ──────────────────────────────────────────────────────
function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  const alertEl = document.getElementById('resetModalAlert');
  if (alertEl) alertEl.className = 'alert hidden';
}

// ── ADMIN ALERTS ───────────────────────────────────────────────
function showAdminAlert(type, msg) {
  const el = document.getElementById('adminAlert');
  el.textContent = msg;
  el.className   = `alert alert-${type}`;
}

function hideAdminAlert() {
  const el = document.getElementById('adminAlert');
  el.className = 'alert hidden';
}

// ── UTILITIES ──────────────────────────────────────────────────
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
