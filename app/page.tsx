export default function HomePage() {
  return (
    <>
      <div id="toast" className="toast" role="status" aria-live="polite" />
      <main id="loginView" className="login-view">
        <section className="login-card">
          <div className="brand-mark">CF</div>
          <p className="eyebrow">CLASS FOOTBALL</p>
          <h1>เข้าสู่สนาม</h1>
          <p className="muted">ใช้ชื่อเล่นของคุณเพื่อประเมินเพื่อนและจัดทีม</p>
          <form id="loginForm" className="login-form">
            <label htmlFor="loginName">ชื่อเล่น</label>
            <select id="loginName" required><option value="">เลือกชื่อของคุณ</option></select>
            <label htmlFor="loginPassword">รหัสผ่านร่วม</label>
            <input id="loginPassword" type="password" inputMode="numeric" autoComplete="current-password" placeholder="รหัสผ่าน" required />
            <p id="loginError" className="form-error" role="alert" />
            <button className="button primary full" type="submit">เข้าสู่ระบบ <span aria-hidden="true">→</span></button>
          </form>
          <p className="login-footnote">ข้อมูลคะแนนจะแสดงแบบไม่ระบุตัวผู้ประเมิน</p>
        </section>
      </main>

      <div id="appView" className="app-view hidden">
        <aside className="sidebar">
          <div className="sidebar-brand"><div className="brand-mark small">CF</div><div><strong>CLASS</strong><span>FOOTBALL</span></div></div>
          <nav className="side-nav" aria-label="เมนูหลัก">
            <button data-page="dashboard" className="nav-item active"><span className="nav-icon">◈</span> ภาพรวม</button>
            <button data-page="ranking" className="nav-item"><span className="nav-icon">↗</span> อันดับ</button>
            <button data-page="assessment" className="nav-item"><span className="nav-icon">◎</span> ประเมินเพื่อน</button>
            <button data-page="teams" className="nav-item"><span className="nav-icon">⇄</span> จัดทีม</button>
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-round"><span className="live-dot" /><span id="roundLabel">รอบที่ 1</span></div>
            <button id="logoutButton" className="logout-button">ออกจากระบบ <span>↗</span></button>
          </div>
        </aside>
        <section className="main-column">
          <header className="topbar">
            <div className="topbar-title"><span className="mobile-brand">CF</span><span id="pageKicker" className="eyebrow">CLASS FOOTBALL / ภาพรวม</span></div>
            <div className="user-chip"><span className="user-avatar" id="userAvatar">?</span><span><b id="userName">ผู้เล่น</b><small id="userPosition">PLAYER</small></span></div>
          </header>
          <main id="pageContent" className="page-content" />
          <footer className="footer">CLASS FOOTBALL <span>•</span> ทุกคะแนนปรับปรุงได้ในรอบนี้</footer>
        </section>
      </div>

      <dialog id="profileDialog" className="profile-dialog">
        <button id="closeProfile" className="dialog-close" aria-label="ปิด">×</button>
        <div id="profileContent" />
      </dialog>
    </>
  );
}
