// ============================================================
//  APPLY — Main App Logic
// ============================================================

// ── State ────────────────────────────────────────────────────
let jobs = JSON.parse(localStorage.getItem('apply_jobs') || '[]');
let cv   = localStorage.getItem('apply_cv') || '';
let accessToken = null;
let driveFolderId = null;
let activeJobId = null;

// ── Google Identity init ─────────────────────────────────────
function initGoogle() {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    window.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file profile email',
      callback: handleToken,
    });
    // Check if we have a stored token/user from a previous session
    const storedUser = localStorage.getItem('apply_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      showApp(user);
      // Request a fresh token silently (no prompt)
      window.tokenClient.requestAccessToken({ prompt: '' });
    } else {
      showAuth();
    }
  };
  document.head.appendChild(script);
}

document.getElementById('sign-in-btn').addEventListener('click', () => {
  window.tokenClient.requestAccessToken({ prompt: 'consent' });
});

async function handleToken(resp) {
  if (resp.error) { console.error(resp); return; }
  accessToken = resp.access_token;
  // Fetch user profile
  const profileResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = await profileResp.json();
  const user = { name: profile.given_name || profile.name, picture: profile.picture, email: profile.email };
  localStorage.setItem('apply_user', JSON.stringify(user));
  showApp(user);
  ensureDriveFolder();
}

function showAuth() {
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp(user) {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-name').textContent = user.name;
  if (user.picture) document.getElementById('user-avatar').src = user.picture;
  document.getElementById('cv-input').value = cv;
  renderDashboard();
  renderJobs();
}

document.getElementById('sign-out-btn').addEventListener('click', () => {
  localStorage.removeItem('apply_user');
  accessToken = null;
  driveFolderId = null;
  showAuth();
});

// ── Tab navigation ───────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'jobs') renderJobs();
  });
});

// ── CV ───────────────────────────────────────────────────────
function saveCV() {
  cv = document.getElementById('cv-input').value.trim();
  localStorage.setItem('apply_cv', cv);
  const msg = document.getElementById('cv-save-msg');
  msg.textContent = 'Saved ✓';
  setTimeout(() => msg.textContent = '', 2500);
}

// ── Add Job ──────────────────────────────────────────────────
function addJob() {
  const title   = document.getElementById('job-title').value.trim();
  const company = document.getElementById('job-company').value.trim();
  const desc    = document.getElementById('job-desc').value.trim();
  const status  = document.getElementById('job-status').value;
  const url     = document.getElementById('job-url').value.trim();
  if (!title || !company || !desc) {
    alert('Please fill in job title, company, and job description.');
    return;
  }
  const job = {
    id: Date.now(), title, company, desc, status, url,
    added: new Date().toLocaleDateString('en-NZ', { day:'numeric', month:'short', year:'numeric' }),
    tailoredCV: '', coverLetter: '', driveCV: '', driveCL: ''
  };
  jobs.unshift(job);
  persistJobs();
  // Clear form
  ['job-title','job-company','job-desc','job-url'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('job-status').value = 'saved';
  // Switch to Applications tab
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="jobs"]').classList.add('active');
  document.getElementById('tab-jobs').classList.add('active');
  renderJobs();
}

// ── Persist ──────────────────────────────────────────────────
function persistJobs() {
  localStorage.setItem('apply_jobs', JSON.stringify(jobs));
}

// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  const counts = { saved:0, applied:0, interview:0, offer:0, rejected:0 };
  jobs.forEach(j => counts[j.status]++);
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-num">${jobs.length}</div><div class="stat-label">Total</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${counts.applied}</div><div class="stat-label">Applied</div></div>
    <div class="stat-card"><div class="stat-num accent">${counts.interview}</div><div class="stat-label">Interview</div></div>
    <div class="stat-card"><div class="stat-num green">${counts.offer}</div><div class="stat-label">Offer</div></div>
    <div class="stat-card"><div class="stat-num red">${counts.rejected}</div><div class="stat-label">Rejected</div></div>
  `;
  const recent = jobs.slice(0, 5);
  document.getElementById('recent-jobs').innerHTML = recent.length
    ? recent.map(jobCardHTML).join('')
    : '<div class="empty-state"><p>No applications yet — add your first job!</p></div>';
  document.querySelectorAll('#recent-jobs .job-card').forEach(card => {
    card.addEventListener('click', () => openModal(parseInt(card.dataset.id)));
  });
}

// ── Job List ─────────────────────────────────────────────────
function renderJobs() {
  const filter = document.getElementById('status-filter')?.value || 'all';
  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);
  const list = document.getElementById('jobs-list');
  if (!list) return;
  list.innerHTML = filtered.length
    ? filtered.map(jobCardHTML).join('')
    : '<div class="empty-state"><p>' + (filter === 'all' ? 'No applications yet.' : `No ${filter} applications.`) + '</p></div>';
  list.querySelectorAll('.job-card').forEach(card => {
    card.addEventListener('click', () => openModal(parseInt(card.dataset.id)));
  });
}

function jobCardHTML(j) {
  const docs = [j.tailoredCV && 'CV', j.coverLetter && 'Cover letter'].filter(Boolean).join(', ');
  return `
    <div class="job-card" data-id="${j.id}">
      <div class="job-card-main">
        <div class="job-card-title">${j.title}</div>
        <div class="job-card-sub">${j.company} · Added ${j.added}${docs ? ' · ' + docs : ''}</div>
      </div>
      <div class="job-card-right">
        <span class="badge badge-${j.status}">${j.status.charAt(0).toUpperCase()+j.status.slice(1)}</span>
      </div>
    </div>`;
}

// ── Modal ────────────────────────────────────────────────────
function openModal(id) {
  const j = jobs.find(j => j.id === id);
  if (!j) return;
  activeJobId = id;
  document.getElementById('modal-title').textContent = j.title;
  document.getElementById('modal-company').textContent = j.company;
  document.getElementById('modal-desc').textContent = j.desc;
  document.getElementById('modal-cv').textContent = j.tailoredCV || '';
  document.getElementById('modal-cl').textContent = j.coverLetter || '';
  document.getElementById('cv-placeholder').style.display = j.tailoredCV ? 'none' : 'block';
  document.getElementById('cl-placeholder').style.display = j.coverLetter ? 'none' : 'block';
  document.getElementById('download-cv-btn').classList.toggle('hidden', !j.tailoredCV);
  document.getElementById('download-cl-btn').classList.toggle('hidden', !j.coverLetter);
  const sel = document.getElementById('modal-status');
  sel.innerHTML = ['saved','applied','interview','offer','rejected']
    .map(s => `<option value="${s}"${j.status===s?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`)
    .join('');
  showMTab('desc', document.querySelector('.mtab'));
  document.getElementById('modal-overlay') // reset
  document.getElementById('job-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('job-modal').classList.add('hidden');
  activeJobId = null;
  document.getElementById('ai-status-bar').classList.add('hidden');
}

function showMTab(name, btn) {
  document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mtab-content').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelector(`.mtab:nth-child(${name==='desc'?1:name==='cv'?2:3})`).classList.add('active');
  document.getElementById('mtab-' + name).classList.add('active');
}

function updateModalStatus() {
  const j = jobs.find(j => j.id === activeJobId);
  if (!j) return;
  j.status = document.getElementById('modal-status').value;
  persistJobs();
  renderJobs();
  renderDashboard();
}

function modalDelete() {
  if (!confirm('Delete this application?')) return;
  jobs = jobs.filter(j => j.id !== activeJobId);
  persistJobs();
  closeModal();
  renderJobs();
  renderDashboard();
}

// ── AI Calls ─────────────────────────────────────────────────
function setAIStatus(msg, isError = false) {
  const bar = document.getElementById('ai-status-bar');
  bar.classList.remove('hidden', 'error');
  if (isError) bar.classList.add('error');
  bar.innerHTML = isError
    ? `<span>${msg}</span>`
    : `<div class="spinner"></div><span>${msg}</span>`;
}

function clearAIStatus() {
  document.getElementById('ai-status-bar').classList.add('hidden');
}

async function callClaude(prompt) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  const data = await resp.json();
  return data.content?.map(c => c.text || '').join('') || '';
}

async function modalTailorCV() {
  const j = jobs.find(j => j.id === activeJobId);
  if (!j) return;
  if (!cv) { alert('Please save your CV first in the "My CV" section.'); return; }
  setAIStatus('Tailoring your CV for this role…');
  try {
    const result = await callClaude(
      `You are a professional CV writer. Tailor the following CV for the job description below.\n` +
      `Keep the same structure and truthful content, but adjust language, emphasis, and skills to match what the employer is looking for.\n` +
      `Do not invent experience that is not in the original CV. Return only the tailored CV text with no preamble or commentary.\n\n` +
      `--- ORIGINAL CV ---\n${cv}\n\n--- JOB: ${j.title} at ${j.company} ---\n${j.desc}`
    );
    j.tailoredCV = result;
    persistJobs();
    document.getElementById('modal-cv').textContent = result;
    document.getElementById('cv-placeholder').style.display = 'none';
    document.getElementById('download-cv-btn').classList.remove('hidden');
    showMTab('cv', document.querySelectorAll('.mtab')[1]);
    clearAIStatus();
  } catch (e) {
    setAIStatus('Error generating CV — check your API key in config.js', true);
  }
}

async function modalCoverLetter() {
  const j = jobs.find(j => j.id === activeJobId);
  if (!j) return;
  if (!cv) { alert('Please save your CV first in the "My CV" section.'); return; }
  setAIStatus('Writing your cover letter…');
  try {
    const result = await callClaude(
      `You are a professional cover letter writer. Write a compelling, specific cover letter for the following job application.\n` +
      `Use the CV for background on the applicant. The letter should be 3–4 paragraphs, professional but warm in tone,\n` +
      `and tailored specifically to the role and company. Avoid generic filler language. Include today's date and a professional sign-off.\n` +
      `Return only the cover letter text with no preamble.\n\n` +
      `--- CV ---\n${cv}\n\n--- JOB: ${j.title} at ${j.company} ---\n${j.desc}`
    );
    j.coverLetter = result;
    persistJobs();
    document.getElementById('modal-cl').textContent = result;
    document.getElementById('cl-placeholder').style.display = 'none';
    document.getElementById('download-cl-btn').classList.remove('hidden');
    showMTab('cl', document.querySelectorAll('.mtab')[2]);
    clearAIStatus();
  } catch (e) {
    setAIStatus('Error generating cover letter — check your API key in config.js', true);
  }
}

// ── Google Drive ─────────────────────────────────────────────
async function driveRequest(url, options = {}) {
  if (!accessToken) throw new Error('Not signed in to Google');
  return fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) }
  });
}

async function ensureDriveFolder() {
  if (driveFolderId) return driveFolderId;
  // Search for existing folder
  const q = encodeURIComponent(`name='${CONFIG.DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const resp = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
  const data = await resp.json();
  if (data.files && data.files.length > 0) {
    driveFolderId = data.files[0].id;
    return driveFolderId;
  }
  // Create folder
  const createResp = await driveRequest('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: CONFIG.DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
  });
  const folder = await createResp.json();
  driveFolderId = folder.id;
  return driveFolderId;
}

async function saveToGDrive(type) {
  const j = jobs.find(j => j.id === activeJobId);
  if (!j) return;
  const content = type === 'cv' ? j.tailoredCV : j.coverLetter;
  const suffix  = type === 'cv' ? 'Tailored-CV' : 'Cover-Letter';
  const slug    = `${j.company.replace(/[^a-z0-9]/gi,'-')}_${j.title.replace(/[^a-z0-9]/gi,'-')}`;
  const filename = `${slug}_${suffix}.txt`;
  setAIStatus('Saving to Google Drive…');
  try {
    const folderId = await ensureDriveFolder();
    // Check if file already exists in folder, delete it first (overwrite)
    const q = encodeURIComponent(`name='${filename}' and '${folderId}' in parents and trashed=false`);
    const existing = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
    const exData = await existing.json();
    if (exData.files && exData.files.length > 0) {
      await driveRequest(`https://www.googleapis.com/drive/v3/files/${exData.files[0].id}`, { method: 'DELETE' });
    }
    // Upload new file
    const meta = JSON.stringify({ name: filename, parents: [folderId] });
    const body = new Blob([
      '--boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n' +
      '--boundary\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n' + content + '\r\n--boundary--'
    ], { type: 'multipart/related; boundary=boundary' });
    const uploadResp = await driveRequest(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      { method: 'POST', body }
    );
    const file = await uploadResp.json();
    // Store Drive link on job
    if (type === 'cv') j.driveCV = file.webViewLink;
    else j.driveCL = file.webViewLink;
    persistJobs();
    clearAIStatus();
    setAIStatus(`Saved to Drive: "${CONFIG.DRIVE_FOLDER_NAME}/${filename}" ✓`);
    setTimeout(clearAIStatus, 4000);
  } catch (e) {
    console.error(e);
    setAIStatus('Drive save failed — check your Google OAuth setup in config.js', true);
  }
}

// ── Boot ─────────────────────────────────────────────────────
initGoogle();
