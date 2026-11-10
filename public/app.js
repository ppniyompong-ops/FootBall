const criteria = [
  { key: 'fitness', label: 'ความฟิต', en: 'FITNESS', weight: '× 1' },
  { key: 'passing', label: 'การจ่ายบอล', en: 'PASSING', weight: '× 1' },
  { key: 'firstTouch', label: 'การรับบอล', en: 'FIRST TOUCH', weight: '× 1' },
  { key: 'shooting', label: 'การยิงประตู', en: 'SHOOTING', weight: '× 1.5' },
  { key: 'ballControl', label: 'การควบคุมบอล', en: 'BALL CONTROL', weight: '× 1.5' }
];
const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const content = document.querySelector('#pageContent');
const profileDialog = document.querySelector('#profileDialog');
let currentPlayer = null;
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
  if (response.status === 401 && path !== '/api/login') showLogin();
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
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
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
      <article class="panel formula-panel"><p class="eyebrow">SCORING FORMULA</p><h2>คะแนนถ่วงน้ำหนัก</h2><div class="formula">(Fit + Pass + Touch + 1.5 Shoot + 1.5 Control) <span>÷ 6</span></div><p class="muted">คะแนนเฉลี่ยของทุกคนในแต่ละด้าน</p><div class="criteria-pills"><span>ยิงประตู <b>×1.5</b></span><span>คุมบอล <b>×1.5</b></span><span>ด้านอื่น <b>×1</b></span></div></article>
    </section>
    <section class="panel compact-ranking"><div class="panel-head"><div><p class="eyebrow">LEADERBOARD</p><h2>อันดับล่าสุด</h2></div><button class="text-button" data-go="ranking">ดูทั้งหมด →</button></div><div id="dashboardRanking" class="table-wrap">กำลังโหลด…</div></section>`;
  bindNavigationButtons();
  try {
    const [summary, ranking] = await Promise.all([api('/api/summary'), loadRanking()]);
    document.querySelector('#statGrid').innerHTML = `
      <article class="stat-card"><span class="stat-label">อันดับของคุณ</span><strong>${summary.myRank ? `#${summary.myRank}` : '—'}</strong><small>จากผู้เล่น ${ranking.length} คน</small></article>
      <article class="stat-card accent-card"><span class="stat-label">ประเมินแล้ว</span><strong>${summary.completed}<i>/${summary.total}</i></strong><small>เพื่อนที่คุณให้คะแนน</small></article>
      <article class="stat-card"><span class="stat-label">คะแนนเฉลี่ยห้อง</span><strong>${score(summary.overallAverage)}</strong><small>Weighted Score</small></article>
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
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">LEADERBOARD</p><h1>อันดับผู้เล่น</h1><p class="muted">คะแนนเฉลี่ยจากแบบประเมินที่ส่งแล้ว</p></div><div class="round-pill"><span class="live-dot"></span><span id="rankingRound">กำลังโหลด</span></div></section><section class="panel ranking-panel"><div class="ranking-summary"><div><span class="eyebrow">CLASS RANKING</span><b>18 <small>PLAYERS</small></b></div><span class="privacy-note">🔒 ไม่แสดงชื่อผู้ประเมิน</span></div><div id="rankingTable" class="table-wrap">กำลังโหลด…</div><p class="table-footnote">คะแนนเต็ม 10 · คำนวณตามสูตรถ่วงน้ำหนัก</p></section>`;
  try {
    const data = await api('/api/ranking');
    document.querySelector('#rankingRound').textContent = data.round.title;
    document.querySelector('#rankingTable').innerHTML = rankingTable(data.ranking);
    document.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => openProfile(Number(button.dataset.player))));
  } catch (error) { toast(error.message, true); }
}

function assessmentCard(player) {
  const saved = assessments.get(player.id);
  return `<button class="assessment-player ${saved ? 'assessed' : ''}" data-assess="${player.id}"><span class="player-avatar">${esc(player.name.slice(0,1))}</span><span class="assessment-player-info"><b>${esc(player.name)}</b><small>${esc(player.positions)}</small></span><span class="assessment-status">${saved ? 'แก้ไขคะแนน' : 'ประเมิน'} <b>→</b></span></button>`;
}

async function renderAssessment() {
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">PLAYER ASSESSMENT</p><h1>ประเมินเพื่อน</h1><p class="muted">ให้คะแนน 1–10 ในแต่ละด้าน คะแนนของคุณจะไม่ระบุตัวตน</p></div><span class="assessment-counter">${assessments.size}/17 <small>คน</small></span></section><div class="assessment-layout"><section class="panel player-select-panel"><div class="panel-head"><div><p class="eyebrow">CLASSMATES</p><h2>เลือกผู้เล่น</h2></div></div><div class="search-wrap"><span>⌕</span><input id="playerSearch" placeholder="ค้นหาชื่อเล่น" autocomplete="off"></div><div id="assessmentList" class="assessment-list"></div></section><section class="panel assessment-form-panel" id="assessmentFormPanel"><div class="empty-form"><div class="empty-ball">◎</div><h2>เลือกเพื่อนเพื่อเริ่มประเมิน</h2><p class="muted">คุณประเมินตัวเองไม่ได้ และแก้ไขคะแนนเดิมได้เสมอ</p></div></section></div>`;
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
  panel.innerHTML = `<div class="assessment-form-head"><div><p class="eyebrow">${saved ? 'EDIT ASSESSMENT' : 'NEW ASSESSMENT'}</p><h2>${esc(player.name)}</h2><span class="position-tag">${esc(player.positions)}</span></div><span class="form-avatar">${esc(player.name.slice(0,1))}</span></div><p class="muted form-intro">ให้คะแนนความสามารถตามที่คุณเห็น คะแนนทั้งหมดจะถูกรวมโดยไม่เปิดเผยผู้ประเมิน</p><form id="assessmentForm"><div class="score-inputs">${criteria.map(item => `<label class="score-input-row"><span><b>${item.label}</b><small>${item.en} · ${item.weight}</small></span><select name="${item.key}" aria-label="${item.label}" required>${Array.from({length:10}, (_, index) => index+1).map(value => `<option value="${value}" ${Number(saved?.[item.key === 'firstTouch' ? 'first_touch' : item.key === 'ballControl' ? 'ball_control' : item.key] || 7) === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`).join('')}</div><div class="weighted-preview"><span>คะแนนถ่วงน้ำหนัก</span><b id="weightedPreview">— <small>/ 10</small></b></div><div class="form-actions"><button class="button primary full" type="submit">${saved ? 'บันทึกการแก้ไข' : 'ส่งคะแนน'} <span>→</span></button></div><p class="anonymous-hint">🔒 ไม่เปิดเผยชื่อผู้ประเมิน</p></form>`;
  const form = panel.querySelector('#assessmentForm');
  const updatePreview = () => {
    const values = Object.fromEntries(new FormData(form).entries());
    const calculated = (Number(values.fitness) + Number(values.passing) + Number(values.firstTouch) + 1.5 * Number(values.shooting) + 1.5 * Number(values.ballControl)) / 6;
    panel.querySelector('#weightedPreview').innerHTML = `${calculated.toFixed(2)} <small>/ 10</small>`;
  };
  form.addEventListener('change', updatePreview);
  updatePreview();
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
  content.innerHTML = `<section class="page-heading"><div><p class="eyebrow">BALANCED TEAMS</p><h1>จัดทีมฟุตบอล</h1><p class="muted">จับคู่ทีมจากคะแนนรวมให้ใกล้เคียงกันที่สุด</p></div><button id="rerollTeams" class="button primary">จัดทีมใหม่ <span>⟳</span></button></section><div id="teamResult" class="team-result"><div class="panel loading-card">กำลังคำนวณทีมที่สมดุล…</div></div><p class="team-note">ใช้คะแนน Weighted Score เป็นหลัก · ตำแหน่งแสดงเพื่อเป็นข้อมูลเท่านั้น</p>`;
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
    document.querySelector('#profileContent').innerHTML = `<p class="eyebrow">PLAYER PROFILE</p><div class="profile-heading"><span class="profile-avatar">${esc(player.name.slice(0,1))}</span><div><h2>${esc(player.name)}</h2><span class="position-tag">${esc(player.positions)}</span></div><b class="profile-score">${score(player.weighted_score)}<small>/ 10</small></b></div><p class="privacy-note">🔒 แสดงค่าเฉลี่ยรวม ไม่เปิดเผยรายชื่อผู้ประเมิน · ${player.assessor_count} ผู้ประเมิน</p><div class="profile-stats">${criteria.map(item => { const key = item.key === 'firstTouch' ? 'first_touch' : item.key === 'ballControl' ? 'ball_control' : item.key; return `<div><span>${item.label}</span><b>${score(player[key])}</b></div>`; }).join('')}</div>${data.myAssessment ? '<p class="your-rating-note">คุณได้ประเมินผู้เล่นคนนี้แล้ว</p>' : player.id === currentPlayer.id ? '<p class="your-rating-note">โปรไฟล์ของคุณจะแสดงค่าเฉลี่ยจากเพื่อน</p>' : '<p class="your-rating-note">คุณยังไม่ได้ประเมินผู้เล่นคนนี้</p>'}`;
    profileDialog.showModal();
  } catch (error) { toast(error.message, true); }
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
document.querySelector('#logoutButton').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); showLogin(); });
document.querySelector('#closeProfile').addEventListener('click', () => profileDialog.close());
profileDialog.addEventListener('click', event => { if (event.target === profileDialog) profileDialog.close(); });

async function boot() {
  try {
    const { players: roster } = await api('/api/roster');
    const select = document.querySelector('#loginName');
    select.innerHTML += roster.map(player => `<option value="${esc(player.name)}">${esc(player.name)} · ${esc(player.positions)}</option>`).join('');
  } catch (error) { document.querySelector('#loginError').textContent = error.message; }
  try {
    const { player } = await api('/api/me');
    await startApp(player);
  } catch { showLogin(); }
}

boot();
