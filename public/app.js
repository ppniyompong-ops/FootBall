const playerCriteria = [
  { key: 'fitness', storage: 'fitness', label: 'ความฟิต', en: 'FITNESS' },
  { key: 'passing', storage: 'passing', label: 'การจ่ายบอล', en: 'PASSING' },
  { key: 'firstTouch', storage: 'first_touch', label: 'การรับบอล', en: 'FIRST TOUCH' },
  { key: 'shooting', storage: 'shooting', label: 'การยิงประตู', en: 'SHOOTING' },
  { key: 'ballControl', storage: 'ball_control', label: 'การควบคุมบอล', en: 'BALL CONTROL' }
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
let teamRun = 0;
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
      <div><p class="eyebrow">สนามของคุณ</p><h1>สวัสดี ${esc(currentPlayer.name)} <span class="wave">✦</span></h1><p class="muted">ช่วยกันประเมินให้ครบ แล้วมาดูทีมที่สมดุลที่สุด</p></div>
      <button class="button primary" data-go="assessment">เริ่มประเมิน <span>→</span></button>
    </section>
    <section class="stat-grid" id="statGrid"><div class="stat-card loading-card">กำลังโหลดข้อมูล…</div></section>
    <section class="dashboard-grid">
      <article class="panel progress-panel"><div class="panel-head"><div><p class="eyebrow">YOUR CHECKLIST</p><h2>ความคืบหน้าการประเมิน</h2></div><span class="panel-icon">◎</span></div><div id="progressContent" class="progress-content">กำลังโหลด…</div></article>
    </section>
    <section class="panel compact-ranking"><div class="panel-head"><div><p class="eyebrow">LEADERBOARD</p><h2>อันดับล่าสุด</h2></div><button class="text-button" data-go="ranking">ดูทั้งหมด →</button></div><div id="dashboardRanking" class="table-wrap">กำลังโหลด…</div></section>`;
  bindNavigationButtons();
  try {
    const [summary, ranking] = await Promise.all([api('/api/summary'), loadRanking()]);
    document.querySelector('#statGrid').innerHTML = `
      <article class="stat-card"><span class="stat-label">อันดับของคุณ</span><strong>${summary.myRank ? `#${summary.myRank}` : '—'}</strong><small>จากผู้เล่น ${ranking.length} คน</small></article>
      <article class="stat-card accent-card"><span class="stat-label">ประเมินแล้ว</span><strong>${summary.completed}<i>/${summary.total}</i></strong><small>เพื่อนที่คุณให้คะแนน</small></article>
      <article class="stat-card"><span class="stat-label">รอบประเมิน</span><strong class="round-stat">${esc(summary.round.title)}</strong><small>คะแนนแก้ไขได้ตลอดรอบ</small></article>`;
    const percent = Math.round(summary.completed / summary.total * 100);
    document.querySelector('#progressContent').innerHTML = `<div class="progress-line"><div class="progress-track"><span style="width:${percent}%"></span></div><b>${percent}%</b></div><p class="muted">ส่งแล้ว ${summary.completed} จาก ${summary.total} คน</p><div class="mini-player-list">${players.slice(0, 6).map(player => `<button class="mini-player ${assessments.has(player.id) ? 'done' : ''}" data-assess="${player.id}"><span>${esc(player.name)}</span><b>${assessments.has(player.id) ? '✓' : '+'}</b></button>`).join('')}<button class="mini-player more-player" data-go="assessment">ประเมินเพื่อนคนอื่น <b>→</b></button></div>`;
    document.querySelector('#dashboardRanking').innerHTML = rankingTable(ranking.slice(0, 5), false);
    document.querySelectorAll('[data-assess]').forEach(button => button.addEventListener('click', () => openAssessment(Number(button.dataset.assess))));
    document.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => openProfile(Number(button.dataset.player))));
    bindNavigationButtons();
  } catch (error) { toast(error.message, true); }
}

function rankingTable(rows, showCount = true) {
  if (!rows.length) return '<div class="empty-state">ยังไม่มีข้อมูลอันดับ</div>';
  return `<table><thead><tr><th>อันดับ</th><th>ผู้เล่น</th><th>ตำแหน่ง</th><th>คะแนน</th>${showCount ? '<th>ผู้ประเมิน</th>' : ''}</tr></thead><tbody>${rows.map(player => `<tr class="clickable-row" data-player="${player.id}"><td><span class="rank-badge ${player.rank <= 3 ? `top-${player.rank}` : ''}">${String(player.rank).padStart(2, '0')}</span></td><td><span class="table-player"><span class="player-avatar">${esc(player.name.slice(0,1))}</span><b>${esc(player.name)}</b>${player.id === currentPlayer.id ? '<em>YOU</em>' : ''}</span></td><td><span class="position-tag">${esc(player.positions)}</span></td><td><b class="score-cell">${score(player.weighted_score)}</b></td>${showCount ? `<td class="muted">${player.assessor_count}</td>` : ''}</tr>`).join('')}</tbody></table>`;
}

async function renderRanking() {
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">LEADERBOARD</p><h1>อันดับผู้เล่น</h1><p class="muted">คะแนนจากแบบประเมินที่ส่งแล้ว</p></div><div class="round-pill"><span class="live-dot"></span><span id="rankingRound">กำลังโหลด</span></div></section><section class="panel ranking-panel"><div class="ranking-summary"><div><span class="eyebrow">CLASS RANKING</span><b id="rankingPlayerCount">— <small>PLAYERS</small></b></div><span class="privacy-note">ผู้เล่นทั่วไปไม่เห็นชื่อผู้ให้คะแนน</span></div><div id="rankingTable" class="table-wrap">กำลังโหลด…</div></section>`;
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
  return `<button class="assessment-player ${saved ? 'assessed' : ''}" data-assess="${player.id}"><span class="player-avatar">${esc(player.name.slice(0,1))}</span><span class="assessment-player-info"><b>${esc(player.name)}</b><small>${esc(player.positions)}</small></span><span class="assessment-status">${saved ? 'แก้ไขคะแนน' : 'ประเมิน'} <b>→</b></span></button>`;
}

async function renderAssessment() {
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">PLAYER ASSESSMENT</p><h1>ประเมินเพื่อน</h1><p class="muted">ให้คะแนน 1–10 ในแต่ละด้าน</p></div><span class="assessment-counter">${assessments.size}/${players.length} <small>คน</small></span></section><div class="assessment-layout"><section class="panel player-select-panel"><div class="panel-head"><div><p class="eyebrow">CLASSMATES</p><h2>เลือกผู้เล่น</h2></div></div><div class="search-wrap"><span>⌕</span><input id="playerSearch" placeholder="ค้นหาชื่อเล่น" autocomplete="off"></div><div id="assessmentList" class="assessment-list"></div></section><section class="panel assessment-form-panel" id="assessmentFormPanel"><div class="empty-form"><div class="empty-ball">◎</div><h2>เลือกเพื่อนเพื่อเริ่มประเมิน</h2><p class="muted">คุณประเมินตัวเองไม่ได้ และแก้ไขคะแนนเดิมได้เสมอ</p></div></section></div>`;
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
  panel.innerHTML = `<div class="assessment-form-head"><div><p class="eyebrow">${saved ? 'EDIT ASSESSMENT' : 'NEW ASSESSMENT'}</p><h2>${esc(player.name)}</h2><span class="position-tag">${esc(player.positions)}</span></div><span class="form-avatar">${esc(player.name.slice(0,1))}</span></div><p class="muted form-intro">ให้คะแนนความสามารถของผู้เล่นคนนี้ตามที่คุณเห็น</p><form id="assessmentForm"><div class="score-inputs">${criteria.map(item => `<label class="score-input-row"><span><b>${item.label}</b><small>${item.en}</small></span><select name="${item.key}" aria-label="${item.label}" required>${Array.from({length:10}, (_, index) => index+1).map(value => `<option value="${value}" ${Number(saved?.[item.storage] || 7) === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`).join('')}</div><div class="form-actions"><button class="button primary full" type="submit">${saved ? 'บันทึกการแก้ไข' : 'ส่งคะแนน'} <span>→</span></button></div><p class="anonymous-hint">ผู้เล่นทั่วไปไม่เห็นชื่อผู้ให้คะแนน</p></form>`;
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
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">BALANCED TEAMS</p><h1>จัดทีมฟุตบอล</h1><p class="muted">จัดทีมสองฝั่งให้สมดุล</p></div><button id="rerollTeams" class="button primary">จัดทีมใหม่ <span>⟳</span></button></section><div id="teamResult" class="team-result"><div class="panel loading-card">กำลังจัดทีม…</div></div>`;
  document.querySelector('#rerollTeams').addEventListener('click', () => { teamRun++; loadTeams(); });
  await loadTeams();
}

async function loadTeams() {
  const node = document.querySelector('#teamResult');
  if (!node) return;
  node.innerHTML = '<div class="panel loading-card">กำลังคำนวณทีมที่สมดุล…</div>';
  try {
    const data = await api(`/api/teams?run=${teamRun}`);
    const drawTeam = (team, name, color, total) => `<article class="team-card ${color}"><header><div><span class="eyebrow">${name === 'ทีม A' ? 'GREEN SQUAD' : 'WHITE SQUAD'}</span><h2>${name}</h2></div><div class="team-score"><b>${score(total)}</b><small>คะแนนรวม</small></div></header><div class="team-player-list">${team.map((player,index) => `<div class="team-player"><span class="team-number">${String(index+1).padStart(2,'0')}</span><span class="player-avatar">${esc(player.name.slice(0,1))}</span><span class="team-player-info"><b>${esc(player.name)}</b><small>${esc(player.positions)}</small></span><b class="team-player-score">${score(player.weighted_score)}</b></div>`).join('')}</div><footer>${team.length} ผู้เล่น <span>ตำแหน่งไม่จำกัด</span></footer></article>`;
    const difference = Math.abs(data.sumA - data.sumB);
    node.innerHTML = `${drawTeam(data.teamA,'ทีม A','green-team',data.sumA)}<div class="versus-column"><span class="versus">VS</span><div class="balance-meter"><small>ส่วนต่าง</small><b>${score(difference)}</b></div></div>${drawTeam(data.teamB,'ทีม B','light-team',data.sumB)}`;
  } catch (error) { node.innerHTML = `<div class="panel empty-state">${esc(error.message)}</div>`; }
}

async function openProfile(playerId) {
  try {
    const data = await api(`/api/profile?id=${playerId}`);
    const player = data.player;
    const criteria = criteriaFor(player);
    document.querySelector('#profileContent').innerHTML = `<p class="eyebrow">PLAYER PROFILE</p><div class="profile-heading"><span class="profile-avatar">${esc(player.name.slice(0,1))}</span><div><h2>${esc(player.name)}</h2><span class="position-tag">${esc(player.positions)}</span></div><b class="profile-score">${score(player.weighted_score)}<small>/ 10</small></b></div><p class="privacy-note">ผู้เล่นทั่วไปไม่เห็นชื่อผู้ให้คะแนน · ${player.assessor_count} ผู้ประเมิน</p><div class="profile-stats">${criteria.map(item => `<div><span>${item.label}</span><b>${score(player[item.storage])}</b></div>`).join('')}</div>${data.myAssessment ? '<p class="your-rating-note">คุณได้ประเมินผู้เล่นคนนี้แล้ว</p>' : player.id === currentPlayer.id ? '<p class="your-rating-note">โปรไฟล์ของคุณจะแสดงค่าเฉลี่ยจากเพื่อน</p>' : '<p class="your-rating-note">คุณยังไม่ได้ประเมินผู้เล่นคนนี้</p>'}`;
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
    node.innerHTML = `<section class="admin-page-heading"><div><p class="eyebrow">ASSESSMENT RECORDS</p><h1>คะแนนที่ส่งแล้ว</h1><p class="muted">เห็นชื่อผู้ให้คะแนน ผู้ถูกประเมิน และคะแนนรายด้าน</p></div><span class="admin-count">${assessments.length} รายการ</span></section><div class="panel admin-filter"><input id="assessmentSearch" placeholder="ค้นหาชื่อผู้ให้คะแนนหรือผู้ถูกประเมิน" autocomplete="off"></div><div id="adminAssessmentList" class="admin-assessment-list"></div>`;
    const renderRows = query => {
      const normalized = query.trim().toLowerCase();
      const visible = assessments.filter(item => `${item.evaluator_name} ${item.player_name}`.toLowerCase().includes(normalized));
      document.querySelector('#adminAssessmentList').innerHTML = visible.length ? visible.map(item => {
        const criteria = criteriaFor({ positions: item.player_positions });
        const values = criteria.map(criterion => `<span class="admin-score-chip"><small>${criterion.label}</small><b>${score(item[criterion.storage])}</b></span>`).join('');
        return `<article class="panel admin-assessment-card"><div class="admin-assessment-heading"><div><span class="eyebrow">ผู้ให้คะแนน</span><b>${esc(item.evaluator_name)}</b></div><span class="admin-arrow">→</span><div><span class="eyebrow">ผู้ถูกประเมิน</span><b>${esc(item.player_name)}</b></div><time>${new Date(item.updated_at).toLocaleString('th-TH')}</time></div><div class="admin-score-list">${values}</div></article>`;
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
  const drawColumn = (team, color, title) => `<section class="admin-team-column ${color}"><header><h2>${title}</h2><span>${adminTeamAssignments.filter(item => item.team === team).length} คน</span></header><div class="admin-team-list">${adminTeamAssignments.filter(item => item.team === team).map(player => `<article class="admin-team-player"><span class="player-avatar">${esc(player.name.slice(0,1))}</span><span><b>${esc(player.name)}</b><small>${esc(player.positions)}</small></span><button type="button" data-move-player="${player.id}" data-to-team="${team === 'A' ? 'B' : 'A'}" aria-label="ย้าย ${esc(player.name)} ไปอีกทีม">⇄</button></article>`).join('')}</div></section>`;
  node.innerHTML = `${drawColumn('A', 'green-team', 'ทีม A')}${drawColumn('B', 'light-team', 'ทีม B')}`;
  node.querySelectorAll('[data-move-player]').forEach(button => button.addEventListener('click', () => {
    const playerId = Number(button.dataset.movePlayer);
    const targetTeam = button.dataset.toTeam;
    const player = adminTeamAssignments.find(item => item.id === playerId);
    if (!player) return;
    const targetCount = adminTeamAssignments.filter(item => item.team === targetTeam).length;
    const sourceCount = adminTeamAssignments.filter(item => item.team === player.team).length;
    if (Math.abs((sourceCount - 1) - (targetCount + 1)) > 2) return toast('จำนวนผู้เล่นสองทีมต้องต่างกันไม่เกิน 2 คนระหว่างการจัด', true);
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
    node.innerHTML = `<section class="admin-page-heading"><div><p class="eyebrow">TEAM BUILDER</p><h1>ปรับทีม</h1><p class="muted">ย้ายผู้เล่นระหว่างทีม แล้วบันทึกการจัดทีมนี้</p></div><button id="saveAdminTeams" class="button primary">บันทึกทีม</button></section><p class="admin-save-state">${data.customized ? 'กำลังแสดงทีมที่บันทึกไว้' : 'เริ่มจากทีมที่ระบบจัดให้สมดุล'}</p><div id="adminTeamBoard" class="admin-team-board"></div>`;
    renderAdminTeamBoard();
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
    const result = await api('/api/login', { method: 'POST', body: JSON.stringify({ name: document.querySelector('#loginName').value, password: document.querySelector('#loginPassword').value }) });
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
    const { players: roster } = await api('/api/roster');
    const select = document.querySelector('#loginName');
    select.innerHTML += roster.map(player => `<option value="${esc(player.name)}">${esc(player.name)}</option>`).join('');
  } catch (error) { document.querySelector('#loginError').textContent = error.message; }
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
