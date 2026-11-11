const playerCriteria = [
  { key: 'pace', storage: 'pace', label: 'ความเร็ว', en: 'PACE' },
  { key: 'passing', storage: 'passing', label: 'การจ่ายบอล', en: 'PASSING' },
  { key: 'dribbling', storage: 'dribbling', label: 'การเลี้ยงบอล', en: 'DRIBBLING' },
  { key: 'shooting', storage: 'shooting', label: 'การยิงประตู', en: 'SHOOTING' },
  { key: 'defending', storage: 'defending', label: 'การป้องกัน', en: 'DEFENDING' }
  { key: 'physicality', storage: 'Physicality', label: 'ความแข็งแกร่ง', en: 'PHYSICALITY' }
];
const goalkeeperCriteria = [
  { key: 'distribution', storage: 'keeper_distribution', label: 'โยนบอลและเตะเปิดเกม', en: 'DISTRIBUTION' },
  { key: 'cutting', storage: 'keeper_cutting', label: 'ออกมาตัดบอล', en: 'CLAIMING' },
  { key: 'highBall', storage: 'keeper_high_ball', label: 'รับลูกสูงแบบสามเหลี่ยม', en: 'HIGH BALL' },
  { key: 'lowBall', storage: 'keeper_low_ball', label: 'รับลูกเลียด', en: 'LOW BALL' },
  { key: 'reflex', storage: 'keeper_reflex', label: 'ปฏิกิริยาเซฟลูกยิง', en: 'REFLEX SAVES' }
  
];
const isGoalkeeper = player => /(^|[/,\s])GK($|[/,\s])/i.test(String(player?.positions || ''));
const criteriaFor = player => isGoalkeeper(player) ? goalkeeperCriteria : playerCriteria;
const teamSeparationPairs = [['เช่', 'พอร์ช'], ['ปกป้อง', 'กังฟู']];
const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const adminView = document.querySelector('#adminView');
const content = document.querySelector('#pageContent');
const profileDialog = document.querySelector('#profileDialog');
let currentPlayer = null;
let currentAdmin = null;
let activeAdminPage = 'assessments';
let activePage = 'dashboard';
let players = [];
let assessments = new Map();
let toastTimeout;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const score = value => Number(value || 0).toFixed(2);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401 && !['/api/login', '/api/admin/login'].includes(path)) showLogin();
  if (!response.ok) throw new Error(result.error || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
  return result;
}

function toast(message, error = false) {
  const node = document.querySelector('#toast');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => node.classList.remove('show'), 2800);
}

function showLogin() {
  currentPlayer = null;
  currentAdmin = null;
  appView.classList.add('hidden');
  adminView.classList.add('hidden');
  loginView.classList.remove('hidden');
  document.querySelector('#loginForm').classList.remove('hidden');
  document.querySelector('#adminLoginToggle').classList.remove('hidden');
  document.querySelector('#adminLoginForm').classList.add('hidden');
  document.querySelector('#adminPassword').value = '';
  document.querySelector('#adminLoginError').textContent = '';
}

async function startApp(player) {
  currentPlayer = player;
  const loginError = document.querySelector('#loginError');
  loginError.textContent = '';
  try {
    const [playerResult, ownResult, me] = await Promise.all([
      api('/api/players'), api('/api/assessments/mine'), api('/api/me')
    ]);
    players = playerResult.players;
    assessments = new Map(ownResult.assessments.map(item => [item.player_id, item]));
    document.querySelector('#roundLabel').textContent = me.round.title;
    document.querySelector('#userName').textContent = player.name;
    document.querySelector('#userPosition').textContent = player.positions;
    document.querySelector('#userAvatar').textContent = player.name.slice(0, 1);
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    await renderPage(activePage);
  } catch (error) {
    showLogin();
    loginError.textContent = error.message;
  }
}

async function loadRanking() {
  return (await api('/api/ranking')).ranking;
}

function navTo(page) {
  activePage = page;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  const names = { dashboard: 'ภาพรวม', ranking: 'อันดับ', assessment: 'ประเมินเพื่อน', teams: 'จัดทีม' };
  document.querySelector('#pageKicker').textContent = `CLASS FOOTBALL / ${names[page]}`;
  renderPage(page).catch(error => toast(error.message, true));
}

async function renderPage(page) {
  if (page === 'dashboard') return renderDashboard();
  if (page === 'ranking') return renderRanking();
  if (page === 'assessment') return renderAssessment();
  if (page === 'teams') return renderTeams();
}

async function renderDashboard() {
  content.innerHTML = `
    <section class="welcome-row">
      <div><p class="eyebrow">สนามของคุณ</p><h1>สวัสดี ${esc(currentPlayer.name)} <span class="wave">✦</span></h1><p class="muted">ช่วยกันประ[...]
      <button class="button primary" data-go="assessment">เริ่มประเมิน <span>→</span></button>
    </section>
    <section class="stat-grid" id="statGrid"><div class="stat-card loading-card">กำลังโหลดข้อมูล…</div></section>
    <section class="dashboard-grid">
      <article class="panel progress-panel"><div class="panel-head"><div><p class="eyebrow">YOUR CHECKLIST</p><h2>ความคืบหน้าการประเมิน</h2></div><span class=[...]
    </section>
    <section class="panel compact-ranking"><div class="panel-head"><div><p class="eyebrow">LEADERBOARD</p><h2>อันดับล่าสุด</h2></div><button class="text-button" data-go="rankin[...]
  bindNavigationButtons();
  try {
    const [summary, ranking] = await Promise.all([api('/api/summary'), loadRanking()]);
    document.querySelector('#statGrid').innerHTML = `
      <article class="stat-card"><span class="stat-label">อันดับของคุณ</span><strong>${summary.myRank ? `#${summary.myRank}` : '—'}</strong><small>จากผู้เล่[...]
      <article class="stat-card accent-card"><span class="stat-label">ประเมินแล้ว</span><strong>${summary.completed}<i>/${summary.total}</i></strong><small>เพื่อนท�[...]
      <article class="stat-card"><span class="stat-label">รอบประเมิน</span><strong class="round-stat">${esc(summary.round.title)}</strong><small>คะแนนแก้ไขไ��[...]
    const percent = Math.round(summary.completed / summary.total * 100);
    document.querySelector('#progressContent').innerHTML = `<div class="progress-line"><div class="progress-track"><span style="width:${percent}%"></span></div><b>${percent}%</b></div><p class="muted"[...]
    document.querySelector('#dashboardRanking').innerHTML = rankingTable(ranking.slice(0, 5), false);
    document.querySelectorAll('[data-assess]').forEach(button => button.addEventListener('click', () => openAssessment(Number(button.dataset.assess))));
    document.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => openProfile(Number(button.dataset.player))));
    bindNavigationButtons();
  } catch (error) { toast(error.message, true); }
}

function rankingTable(rows, showCount = true) {
  if (!rows.length) return '<div class="empty-state">ยังไม่มีข้อมูลอันดับ</div>';
  return `<table><thead><tr><th>อันดับ</th><th>ผู้เล่น</th><th>ตำแหน่ง</th><th>คะแนน</th>${showCount ? '<th>ผู้ประเมิน</th>' : ''}[...]
}

async function renderRanking() {
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">LEADERBOARD</p><h1>อันดับผู้เล่น</h1><p class="muted">คะแนนจากแบบประ�[...]
  try {
    const data = await api('/api/ranking');
    document.querySelector('#rankingRound').textContent = data.round.title;
    document.querySelector('#rankingPlayerCount').innerHTML = `${data.ranking.length} <small>PLAYERS</small>`;
    document.querySelector('#rankingTable').innerHTML = rankingTable(data.ranking);
    document.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => openProfile(Number(button.dataset.player))));
  } catch (error) { toast(error.message, true); }
}

function assessmentCard(player) {
  const saved = assessments.get(player.id);
  return `<button class="assessment-player ${saved ? 'assessed' : ''}" data-assess="${player.id}"><span class="player-avatar">${esc(player.name.slice(0,1))}</span><span class="assessment-player-info>[...]
}

async function renderAssessment() {
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">PLAYER ASSESSMENT</p><h1>ประเมินเพื่อน</h1><p class="muted">ให้คะแนน 1–10 ใ��[...]
  renderAssessmentList(players);
  document.querySelector('#playerSearch').addEventListener('input', event => renderAssessmentList(players.filter(player => player.name.includes(event.target.value.trim()) || player.positions.toLowerCase().includes(event.target.value.trim().toLowerCase()))));
}

function renderAssessmentList(list) {
  const node = document.querySelector('#assessmentList');
  if (!node) return;
  node.innerHTML = list.length ? list.map(assessmentCard).join('') : '<div class="empty-state">ไม่พบชื่อที่ค้นหา</div>';
  node.querySelectorAll('[data-assess]').forEach(button => button.addEventListener('click', () => openAssessment(Number(button.dataset.assess))));
}

function openAssessment(playerId) {
  const player = players.find(item => item.id === playerId);
  if (!player) return;
  const saved = assessments.get(player.id);
  const panel = document.querySelector('#assessmentFormPanel');
  if (!panel) { navTo('assessment'); setTimeout(() => openAssessment(playerId), 0); return; }
  document.querySelectorAll('.assessment-player').forEach(button => button.classList.toggle('selected', Number(button.dataset.assess) === playerId));
  const criteria = criteriaFor(player);
  panel.innerHTML = `<div class="assessment-form-head"><div><p class="eyebrow">${saved ? 'EDIT ASSESSMENT' : 'NEW ASSESSMENT'}</p><h2>${esc(player.name)}</h2><span class="position-tag">${esc(player.po[...]
  const form = panel.querySelector('#assessmentForm');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button[type=submit]');
    submit.disabled = true;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await api('/api/assessments', { method: 'POST', body: JSON.stringify({ playerId, ...values }) });
      const own = await api('/api/assessments/mine');
      assessments = new Map(own.assessments.map(item => [item.player_id, item]));
      toast(result.message);
      await renderAssessment();
      openAssessment(playerId);
    } catch (error) { toast(error.message, true); submit.disabled = false; }
  });
}

async function renderTeams() {
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">BALANCED TEAMS</p><h1>ทีมของห้อง</h1><p class="muted">ดูทีมที่แอดมินจั�[...]
  await loadTeams();
}

async function loadTeams() {
  const node = document.querySelector('#teamResult');
  if (!node) return;
  node.innerHTML = '<div class="panel loading-card">กำลังโหลดทีม…</div>';
  try {
    const data = await api('/api/teams');
    const drawTeam = (team, name, color, total) => `<article class="team-card ${color}"><header><div><span class="eyebrow">${name === 'ทีม A' ? 'GREEN SQUAD' : 'WHITE SQUAD'}</span><h2>${name}</[...]
    const difference = Math.abs(data.sumA - data.sumB);
    node.innerHTML = `${drawTeam(data.teamA,'ทีม A','green-team',data.sumA)}<div class="versus-column"><span class="versus">VS</span><div class="balance-meter"><small>ส่วนต่าง</s[...]
  } catch (error) { node.innerHTML = `<div class="panel empty-state">${esc(error.message)}</div>`; }
}

async function openProfile(playerId) {
  try {
    const data = await api(`/api/profile?id=${playerId}`);
    const player = data.player;
    const criteria = criteriaFor(player);
    document.querySelector('#profileContent').innerHTML = `<p class="eyebrow">PLAYER PROFILE</p><div class="profile-heading"><span class="profile-avatar">${esc(player.name.slice(0,1))}</span><div><h2>[...]
    profileDialog.showModal();
  } catch (error) { toast(error.message, true); }
}

function adminNavTo(page) {
  activeAdminPage = page;
  document.querySelectorAll('.admin-tab').forEach(button => button.classList.toggle('active', button.dataset.adminPage === page));
  if (page === 'teams') renderAdminTeams();
  else renderAdminAssessments();
}

async function startAdmin(admin) {
  currentAdmin = admin;
  currentPlayer = null;
  document.querySelector('#loginError').textContent = '';
  document.querySelector('#adminLoginError').textContent = '';
  loginView.classList.add('hidden');
  appView.classList.add('hidden');
  adminView.classList.remove('hidden');
  await adminNavTo(activeAdminPage);
}

async function renderAdminAssessments() {
  const node = document.querySelector('#adminContent');
  node.innerHTML = '<div class="panel loading-card">กำลังโหลดคะแนน…</div>';
  try {
    const data = await api('/api/admin/assessments');
    document.querySelector('#adminRoundLabel').textContent = data.round.title;
    const assessments = data.assessments;
    node.innerHTML = `<section class="admin-page-heading"><div><p class="eyebrow">ASSESSMENT RECORDS</p><h1>คะแนนที่ส่งแล้ว</h1><p class="muted">เห็นชื่อ�[...]
    const renderRows = query => {
      const normalized = query.trim().toLowerCase();
      const visible = assessments.filter(item => `${item.evaluator_name} ${item.player_name}`.toLowerCase().includes(normalized));
      document.querySelector('#adminAssessmentList').innerHTML = visible.length ? visible.map(item => {
        const criteria = criteriaFor({ positions: item.player_positions });
        const values = criteria.map(criterion => `<span class="admin-score-chip"><small>${criterion.label}</small><b>${score(item[criterion.storage])}</b></span>`).join('');
        return `<article class="panel admin-assessment-card"><div class="admin-assessment-heading"><div><span class="eyebrow">ผู้ให้คะแนน</span><b>${esc(item.evaluator_name)}</b>[...]
      }).join('') : '<div class="panel empty-state">ไม่พบรายการคะแนน</div>';
    };
    renderRows('');
    document.querySelector('#assessmentSearch').addEventListener('input', event => renderRows(event.target.value));
  } catch (error) { node.innerHTML = `<div class="panel empty-state">${esc(error.message)}</div>`; }
}

let adminTeamAssignments = [];

function renderAdminTeamBoard() {
  const node = document.querySelector('#adminTeamBoard');
  if (!node) return;
  const teamA = adminTeamAssignments.filter(item => item.team === 'A');
  const teamB = adminTeamAssignments.filter(item => item.team === 'B');
  const sumA = teamA.reduce((sum, player) => sum + Number(player.weighted_score || 0), 0);
  const sumB = teamB.reduce((sum, player) => sum + Number(player.weighted_score || 0), 0);
  const drawColumn = (team, color, title, total) => `<section class="admin-team-column ${color}"><header><h2>${title}</h2><div class="admin-team-total"><strong>${score(total)}</strong><span>${adminTea[...]
  node.innerHTML = `${drawColumn('A', 'green-team', 'ทีม A', sumA)}<div class="versus-column"><span class="versus">VS</span><div class="balance-meter"><small>คะแนนต่างกัน[...]
  node.querySelectorAll('[data-move-player]').forEach(button => button.addEventListener('click', () => {
    const playerId = Number(button.dataset.movePlayer);
    const targetTeam = button.dataset.toTeam;
    const player = adminTeamAssignments.find(item => item.id === playerId);
    if (!player) return;
    const targetCount = adminTeamAssignments.filter(item => item.team === targetTeam).length;
    const sourceCount = adminTeamAssignments.filter(item => item.team === player.team).length;
    if (Math.abs((sourceCount - 1) - (targetCount + 1)) > 2) return toast('จำนวนผู้เล่นสองทีมต้องต่างกันไม่เกิน 2 คนระ��[...]
    const targetNames = new Set(adminTeamAssignments.filter(item => item.team === targetTeam && item.id !== player.id).map(item => item.name === 'ป้อง' ? 'ปกป้อง' : item.name));
    const playerName = player.name === 'ป้อง' ? 'ปกป้อง' : player.name;
    const conflict = teamSeparationPairs.find(([first, second]) =>
      (playerName === first && targetNames.has(second)) || (playerName === second && targetNames.has(first))
    );
    if (conflict) return toast(`${conflict[0]} กับ ${conflict[1]} ต้องอยู่คนละทีม`, true);
    player.team = targetTeam;
    renderAdminTeamBoard();
  }));
}

async function renderAdminTeams() {
  const node = document.querySelector('#adminContent');
  node.innerHTML = '<div class="panel loading-card">กำลังโหลดทีม…</div>';
  try {
    const data = await api('/api/admin/teams');
    document.querySelector('#adminRoundLabel').textContent = data.round.title;
    adminTeamAssignments = data.assignments;
    node.innerHTML = `<section class="admin-page-heading"><div><p class="eyebrow">TEAM BUILDER</p><h1>ปรับทีม</h1><p class="muted">ย้ายผู้เล่นเองหรื�[...]
    renderAdminTeamBoard();
    document.querySelector('#randomizeAdminTeams').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api('/api/admin/teams', { method: 'POST' });
        toast('สุ่มและบันทึกทีมใหม่แล้ว');
        await renderAdminTeams();
      } catch (error) { toast(error.message, true); button.disabled = false; }
    });
    document.querySelector('#saveAdminTeams').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api('/api/admin/teams', { method: 'PUT', body: JSON.stringify({ assignments: adminTeamAssignments.map(({ id, team }) => ({ id, team })) }) });
        toast('บันทึกการจัดทีมแล้ว');
        await renderAdminTeams();
      } catch (error) { toast(error.message, true); button.disabled = false; }
    });
  } catch (error) { node.innerHTML = `<div class="panel empty-state">${esc(error.message)}</div>`; }
}

function bindNavigationButtons() {
  document.querySelectorAll('[data-go]').forEach(button => button.onclick = () => navTo(button.dataset.go));
}

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => navTo(button.dataset.page)));
document.querySelector('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const errorNode = document.querySelector('#loginError');
  errorNode.textContent = '';
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const result = await api('/api/login', { method: 'POST', body: JSON.stringify({ name: document.querySelector('#loginName').value.trim(), password: document.querySelector('#loginPassword').value }) });
    await startApp(result.player);
  } catch (error) { errorNode.textContent = error.message; }
  finally { submitButton.disabled = false; }
});
document.querySelector('#adminLoginToggle').addEventListener('click', () => {
  document.querySelector('#loginForm').classList.add('hidden');
  document.querySelector('#adminLoginToggle').classList.add('hidden');
  document.querySelector('#adminLoginForm').classList.remove('hidden');
  document.querySelector('#adminPassword').focus();
});
document.querySelector('#playerLoginToggle').addEventListener('click', () => {
  document.querySelector('#adminLoginForm').classList.add('hidden');
  document.querySelector('#loginForm').classList.remove('hidden');
  document.querySelector('#adminLoginToggle').classList.remove('hidden');
});
document.querySelector('#adminLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const errorNode = document.querySelector('#adminLoginError');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  errorNode.textContent = '';
  button.disabled = true;
  try {
    const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: document.querySelector('#adminPassword').value }) });
    await startAdmin(result.admin);
  } catch (error) { errorNode.textContent = error.message; }
  finally { button.disabled = false; }
});
document.querySelectorAll('.admin-tab').forEach(button => button.addEventListener('click', () => adminNavTo(button.dataset.adminPage)));
document.querySelector('#adminLogoutButton').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); showLogin(); });
document.querySelector('#logoutButton').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); showLogin(); });
document.querySelector('#closeProfile').addEventListener('click', () => profileDialog.close());
profileDialog.addEventListener('click', event => { if (event.target === profileDialog) profileDialog.close(); });

async function boot() {
  try {
    const { admin } = await api('/api/admin/me');
    await startAdmin(admin);
    return;
  } catch {}
  try {
    const { player } = await api('/api/me');
    await startApp(player);
  } catch { showLogin(); }
}

boot();
