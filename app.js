/* ============================================================
   app.js — Narayana Techno Schools Cabinet Elections 2026–27
   Student Voting Portal
   ============================================================ */

// ── CONFIGURATION ─────────────────────────────────────────────
// Set the deployed Google Apps Script Web App URL in site-config.js.
// Steps to deploy:
//   1. Open your Google Sheet > Extensions > Apps Script
//   2. Paste Code.gs content and save
//   3. Click Deploy > New Deployment > Web App
//      Execute as: Me | Who has access: Anyone
//   4. Copy the generated URL and paste it into site-config.js.
const CONFIG = {
  SCRIPT_URL: (window.ELECTION_SITE_CONFIG && window.ELECTION_SITE_CONFIG.SCRIPT_URL) || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec',
  CANDIDATES_FILE: 'candidates.json',
  CANDIDATE_LETTERS: ['A', 'B', 'C', 'D'],
};

// ── STATE ──────────────────────────────────────────────────────
const state = {
  candidatesData: null,
  studentName: '',
  admissionNo: '',
  branch: '',
  votes: {},          // { "Head Boy": "Kaggadasapura A", ... }
  currentStep: 1,
  isSubmitting: false,
  resetTimer: null,
  confettiTimer: null,
};

// ── DOM REFERENCES ─────────────────────────────────────────────
const els = {
  statusBadge:     () => document.getElementById('votingStatusBadge'),
  statusText:      () => document.querySelector('#votingStatusBadge .status-text'),
  globalAlert:     () => document.getElementById('globalAlert'),
  step1:           () => document.getElementById('step1'),
  step2:           () => document.getElementById('step2'),
  step3:           () => document.getElementById('step3'),
  step4:           () => document.getElementById('step4'),
  lockedPanel:     () => document.getElementById('votingLockedPanel'),
  studentForm:     () => document.getElementById('studentForm'),
  studentName:     () => document.getElementById('studentName'),
  admissionNo:     () => document.getElementById('admissionNo'),
  branchSelect:    () => document.getElementById('branchSelect'),
  nameError:       () => document.getElementById('nameError'),
  admNoError:      () => document.getElementById('admNoError'),
  branchError:     () => document.getElementById('branchError'),
  proceedBtn:      () => document.getElementById('proceedBtn'),
  voterInfoStrip:  () => document.getElementById('voterInfoStrip'),
  voterNameDisp:   () => document.getElementById('voterNameDisplay'),
  voterBranchDisp: () => document.getElementById('voterBranchDisplay'),
  positionsGrid:   () => document.getElementById('positionsGrid'),
  selectedCount:   () => document.getElementById('selectedCount'),
  totalPositions:  () => document.getElementById('totalPositions'),
  progressFill:    () => document.getElementById('progressFill'),
  reviewBtn:       () => document.getElementById('reviewBtn'),
  backToStep1Btn:  () => document.getElementById('backToStep1Btn'),
  reviewStudentInfo:() => document.getElementById('reviewStudentInfo'),
  reviewGrid:      () => document.getElementById('reviewGrid'),
  reviewAlert:     () => document.getElementById('reviewAlert'),
  backToStep2Btn:  () => document.getElementById('backToStep2Btn'),
  submitVoteBtn:   () => document.getElementById('submitVoteBtn'),
  successMeta:     () => document.getElementById('successMeta'),
  voteAnotherBtn:  () => document.getElementById('voteAnotherBtn'),
  confettiContainer: () => document.getElementById('confettiContainer'),
  stepsIndicator:  () => document.getElementById('stepsIndicator'),
};

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadCandidatesData();
  populateBranchDropdown();
  checkVotingStatus();
  bindEvents();
});

async function loadCandidatesData() {
  try {
    const res = await fetch(CONFIG.CANDIDATES_FILE);
    state.candidatesData = await res.json();
  } catch (err) {
    if (window.DEFAULT_CANDIDATES_DATA) {
      state.candidatesData = JSON.parse(JSON.stringify(window.DEFAULT_CANDIDATES_DATA));
      console.warn('Using built-in candidate configuration fallback:', err);
      return;
    }

    showGlobalAlert('error', 'Failed to load election configuration. Please refresh the page.');
    console.error('Failed to load candidates.json:', err);
  }
}

function populateBranchDropdown() {
  const select = els.branchSelect();
  if (!state.candidatesData) return;

  const branches = [...state.candidatesData.branches].sort();
  branches.forEach(branch => {
    const opt = document.createElement('option');
    opt.value = branch;
    opt.textContent = branch;
    select.appendChild(opt);
  });
}

async function checkVotingStatus() {
  const badge = els.statusBadge();
  const text  = els.statusText();
  try {
    const url = `${CONFIG.SCRIPT_URL}?action=getStatus`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.locked) {
      badge.className = 'voting-status-badge locked';
      text.textContent = 'Voting Closed';
      showLockedState();
    } else {
      badge.className = 'voting-status-badge open';
      text.textContent = 'Voting Open';
    }
  } catch (err) {
    // If we can't reach the server, assume open and let the vote submission handle errors
    badge.className = 'voting-status-badge open';
    text.textContent = 'Voting Open';
    console.warn('Could not verify voting status:', err);
  }
}

// ── EVENT BINDING ──────────────────────────────────────────────
function bindEvents() {
  els.studentForm().addEventListener('submit', handleStep1Submit);
  els.backToStep1Btn().addEventListener('click', () => goToStep(1));
  els.reviewBtn().addEventListener('click', handleGoToReview);
  els.backToStep2Btn().addEventListener('click', () => goToStep(2));
  els.submitVoteBtn().addEventListener('click', handleSubmitVote);
  els.voteAnotherBtn().addEventListener('click', resetAll);
}

// ── STEP 1: Validate & Check Admission No ─────────────────────
async function handleStep1Submit(e) {
  e.preventDefault();
  if (state.isSubmitting) return;

  const name   = els.studentName().value.trim();
  const admNo  = els.admissionNo().value.trim();
  const branch = els.branchSelect().value;

  clearErrors();

  let valid = true;
  if (!name) { setError('nameError', 'Full name is required.'); valid = false; }
  if (!admNo) {
    setError('admNoError', 'Admission number is required.');
    valid = false;
  } else if (!isSevenDigitAdmissionNo(admNo)) {
    setError('admNoError', 'Admission number must be exactly 7 digits.');
    valid = false;
  }
  if (!branch) { setError('branchError', 'Please select your branch.'); valid = false; }

  if (!valid) return;

  // Check duplicate vote via API
  state.isSubmitting = true;
  setButtonLabel(els.proceedBtn(), 'Validating Admission Number...');
  setButtonLoading(els.proceedBtn(), true);

  try {
    const url = `${CONFIG.SCRIPT_URL}?action=checkVote&admissionNo=${encodeURIComponent(admNo)}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Verification failed.');
    if (data.voted) {
      setError('admNoError', 'This admission number has already been used to vote.');
      return;
    }

    // All good — proceed to step 2
    state.studentName = name;
    state.admissionNo = admNo;
    state.branch      = branch;
    state.votes       = {};

    renderCandidates();
    goToStep(2);

  } catch (err) {
    // If the Apps Script URL is not configured, allow proceeding in demo mode
    if (CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID_HERE')) {
      state.studentName = name;
      state.admissionNo = admNo;
      state.branch      = branch;
      state.votes       = {};
      renderCandidates();
      showGlobalAlert('warning', 'Demo mode: Google Sheets not connected. Configure SCRIPT_URL in app.js to enable live data.');
      goToStep(2);
    } else {
      showGlobalAlert('error', `Could not verify admission number: ${err.message}`);
    }
  } finally {
    setButtonLabel(els.proceedBtn(), 'Proceed to Vote');
    setButtonLoading(els.proceedBtn(), false);
    state.isSubmitting = false;
  }
}

// ── STEP 2: Render Candidates ──────────────────────────────────
function renderCandidates() {
  if (!state.candidatesData) return;

  const { positions, customCandidates } = state.candidatesData;
  const grid = els.positionsGrid();
  grid.innerHTML = '';

  els.voterNameDisp().textContent  = state.studentName;
  els.voterBranchDisp().textContent = state.branch;
  els.totalPositions().textContent = positions.length;
  updateProgress();

  positions.forEach(position => {
    const candidates = getCandidatesFor(position, state.branch, customCandidates);
    const card = buildPositionCard(position, candidates);
    grid.appendChild(card);
  });
}

function getCandidatesFor(position, branch, customCandidates) {
  // Check for custom candidates
  if (customCandidates && customCandidates[branch] && customCandidates[branch][position]) {
    return customCandidates[branch][position];
  }
  // Default: [Branch] A/B/C/D
  return CONFIG.CANDIDATE_LETTERS.map(l => `${branch} ${l}`);
}

function buildPositionCard(position, candidates) {
  const posId  = position.replace(/\s+/g, '-').toLowerCase();
  const card   = document.createElement('div');
  card.className = 'position-card';
  card.dataset.position = position;

  const header = document.createElement('div');
  header.className = 'position-card-header';
  header.innerHTML = `
    <span class="position-name">${position}</span>
    <span class="position-badge" id="badge-${posId}">Select one</span>
  `;

  const list = document.createElement('div');
  list.className = 'candidate-list';

  candidates.forEach((name, idx) => {
    const initials = name
      .split(' ')
      .map(word => word[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || String(idx + 1);

    const optDiv = document.createElement('div');
    optDiv.className = 'candidate-option';

    const radioId = `${posId}-${idx}`;
    optDiv.innerHTML = `
      <input type="radio" name="${posId}" id="${radioId}" value="${name}">
      <label for="${radioId}" class="candidate-label">
        <span class="candidate-avatar">${initials}</span>
        <span class="candidate-name">${name}</span>
      </label>
    `;

    const radio = optDiv.querySelector('input[type="radio"]');
    radio.addEventListener('change', () => handleCandidateSelect(position, name, posId, card, header));

    list.appendChild(optDiv);
  });

  card.appendChild(header);
  card.appendChild(list);
  return card;
}

function handleCandidateSelect(position, name, posId, card, header) {
  state.votes[position] = name;
  card.classList.add('selected');

  const badge = document.getElementById(`badge-${posId}`);
  if (badge) {
    badge.textContent = name;
    badge.className   = 'position-badge done';
  }

  updateProgress();
}

function updateProgress() {
  if (!state.candidatesData) return;
  const total    = state.candidatesData.positions.length;
  const selected = Object.keys(state.votes).length;
  const pct      = total > 0 ? (selected / total) * 100 : 0;

  els.selectedCount().textContent = selected;
  els.progressFill().style.width  = `${pct}%`;

  const reviewBtn = els.reviewBtn();
  if (selected === total) {
    reviewBtn.disabled = false;
    reviewBtn.classList.remove('btn-secondary');
  } else {
    reviewBtn.disabled = true;
  }
}

// ── STEP 3: Review ─────────────────────────────────────────────
function handleGoToReview() {
  if (!state.candidatesData) return;
  const total    = state.candidatesData.positions.length;
  const selected = Object.keys(state.votes).length;
  if (selected < total) {
    showGlobalAlert('error', 'Please select a candidate for every position before proceeding.');
    return;
  }
  renderReview();
  goToStep(3);
}

function renderReview() {
  const info = els.reviewStudentInfo();
  info.innerHTML = `
    <div class="review-meta-item">
      <span class="review-meta-label">Student Name</span>
      <span class="review-meta-value">${escapeHtml(state.studentName)}</span>
    </div>
    <div class="review-meta-item">
      <span class="review-meta-label">Admission No.</span>
      <span class="review-meta-value">${escapeHtml(state.admissionNo)}</span>
    </div>
    <div class="review-meta-item">
      <span class="review-meta-label">Branch</span>
      <span class="review-meta-value">${escapeHtml(state.branch)}</span>
    </div>
  `;

  const grid = els.reviewGrid();
  grid.innerHTML = '';

  Object.entries(state.votes).forEach(([position, candidate]) => {
    const item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML = `
      <span class="review-position">${position}</span>
      <span class="review-candidate">${escapeHtml(candidate)}</span>
    `;
    grid.appendChild(item);
  });

  hideAlert(els.reviewAlert());
}

// ── STEP 4: Submit Vote ────────────────────────────────────────
async function handleSubmitVote() {
  if (state.isSubmitting) return;
  state.isSubmitting = true;
  setButtonLabel(els.submitVoteBtn(), 'Securing Vote...');
  setButtonLoading(els.submitVoteBtn(), true);
  hideAlert(els.reviewAlert());

  const params = new URLSearchParams({
    action:             'vote',
    name:               state.studentName,
    admissionNo:        state.admissionNo,
    branch:             state.branch,
    headBoy:            state.votes['Head Boy']              || '',
    headGirl:           state.votes['Head Girl']             || '',
    sportsCaptain:      state.votes['Sports Captain']        || '',
    sportsDeputy:       state.votes['Sports Deputy Captain'] || '',
    cyberSentinel:      state.votes['Cyber Sentinel']        || '',
    deputyCyberSentinel:state.votes['Deputy Cyber Sentinel'] || '',
  });

  try {
    const res  = await fetch(`${CONFIG.SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Submission failed.');

    // Success
    showSuccessScreen();

  } catch (err) {
    if (CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID_HERE')) {
      // Demo mode — show success anyway
      showSuccessScreen();
    } else {
      showAlert(els.reviewAlert(), 'error', `Failed to submit vote: ${err.message} Please try again.`);
    }
  } finally {
    setButtonLabel(els.submitVoteBtn(), 'Submit Vote');
    setButtonLoading(els.submitVoteBtn(), false);
    state.isSubmitting = false;
  }
}

function showSuccessScreen() {
  const now   = new Date();
  const meta  = els.successMeta();
  meta.innerHTML = `
    <strong>Voted as:</strong> ${escapeHtml(state.studentName)}<br>
    <strong>Admission No.:</strong> ${escapeHtml(state.admissionNo)}<br>
    <strong>Branch:</strong> ${escapeHtml(state.branch)}<br>
    <strong>Timestamp:</strong> ${now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
  `;

  goToStep(4);
  launchConfetti();
  document.body.classList.add('overlay-open');

  if (state.resetTimer) {
    clearTimeout(state.resetTimer);
  }
  state.resetTimer = window.setTimeout(resetAll, 9500);
}

function launchConfetti() {
  const container = els.confettiContainer();
  if (!container) return;
  container.innerHTML = '';

  const totalPieces = 24;
  for (let i = 0; i < totalPieces; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    const left = Math.random() * 100;
    const delay = Math.random() * 0.35;
    const duration = 1.6 + Math.random() * 0.8;
    const size = 6 + Math.random() * 6;
    piece.style.left = `${left}%`;
    piece.style.top = `${-10 - Math.random() * 20}px`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 0.55}px`;
    piece.style.animationDelay = `${delay}s`;
    piece.style.animationDuration = `${duration}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
  }

  if (state.confettiTimer) {
    clearTimeout(state.confettiTimer);
  }
  state.confettiTimer = window.setTimeout(() => {
    container.innerHTML = '';
    state.confettiTimer = null;
  }, 2600);
}

function resetAll() {
  if (state.resetTimer) {
    clearTimeout(state.resetTimer);
    state.resetTimer = null;
  }
  if (state.confettiTimer) {
    clearTimeout(state.confettiTimer);
    state.confettiTimer = null;
  }
  const confetti = els.confettiContainer();
  if (confetti) confetti.innerHTML = '';
  document.body.classList.remove('overlay-open');

  state.studentName = '';
  state.admissionNo = '';
  state.branch      = '';
  state.votes       = {};
  state.isSubmitting = false;

  els.studentName().value   = '';
  els.admissionNo().value   = '';
  els.branchSelect().value  = '';
  els.positionsGrid().innerHTML = '';
  clearErrors();
  hideAlert(els.globalAlert());
  goToStep(1);
}

// ── LOCKED STATE ───────────────────────────────────────────────
function isSevenDigitAdmissionNo(value) {
  return /^\d{7}$/.test(String(value || '').trim());
}

function showLockedState() {
  ['step1','step2','step3','step4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const locked = els.lockedPanel();
  locked.style.display = 'block';
  locked.classList.add('active');

  const indicator = els.stepsIndicator();
  if (indicator) indicator.style.display = 'none';
  const hero = document.querySelector('.hero-section');
  if (hero) hero.style.marginBottom = '28px';
}

// ── STEP NAVIGATION ────────────────────────────────────────────
function goToStep(n) {
  state.currentStep = n;
  const panels = ['step1', 'step2', 'step3', 'step4'];
  panels.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', i + 1 === n);
    el.style.display = '';
  });

  // Update step indicator
  const steps = document.querySelectorAll('.steps-indicator .step');
  steps.forEach((step, i) => {
    const stepNum = i + 1;
    step.classList.remove('active', 'completed');
    if (stepNum < n)      step.classList.add('completed');
    else if (stepNum === n) step.classList.add('active');
  });

  // Hide indicator on success screen
  const indicator = els.stepsIndicator();
  if (indicator) indicator.style.display = n === 4 ? 'none' : '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── UTILITIES ──────────────────────────────────────────────────
function setError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  // Also mark the associated input as error
  const inputId = id.replace('Error', '').replace('admNo', 'admission').replace('branch', 'branch');
  const input = id === 'nameError'   ? els.studentName()  :
                id === 'admNoError'  ? els.admissionNo()  :
                id === 'branchError' ? els.branchSelect()  : null;
  if (input) input.classList.add('error');
}

function clearErrors() {
  ['nameError','admNoError','branchError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  [els.studentName(), els.admissionNo(), els.branchSelect()].forEach(el => {
    if (el) el.classList.remove('error');
  });
}

function showGlobalAlert(type, msg) {
  const el = els.globalAlert();
  el.textContent = msg;
  el.className   = `alert alert-${type}`;
  el.classList.remove('hidden');
}

function setButtonLabel(btn, label) {
  const text = btn && btn.querySelector('.btn-text');
  if (text) text.textContent = label;
}

function hideAlert(el) {
  if (el) { el.className = 'alert hidden'; el.textContent = ''; }
}

function showAlert(el, type, msg) {
  el.textContent = msg;
  el.className   = `alert alert-${type}`;
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  if (loading) {
    btn.disabled = true;
    if (text)    text.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');
  } else {
    btn.disabled = false;
    if (text)    text.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}
