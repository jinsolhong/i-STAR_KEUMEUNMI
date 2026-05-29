// ════════════════════════════════════════════════════════
// app.js — 메인 앱 진입점 & 라우터 & Realtime 구독
// ════════════════════════════════════════════════════════

const App = {
  currentView: 'dashboard',

  // ════════════════════════════════════════════════════
  // 초기화
  // ════════════════════════════════════════════════════
  async init() {
    // 1) Supabase 설정 값 체크
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      this._showConfigWarning();
      return;
    }

    // 2) 로그인 폼 이벤트 바인딩
    this._bindLoginForm();

    // 3) Auth 상태 리스너 등록
    Auth.onAuthStateChange(async (event, session) => {
      if (session) {
        UI.renderApp();
        this._bindNav();
        await this.navigate('dashboard');
        this._setupRealtime();
      } else {
        Realtime.unsubscribeAll();
        UI.renderLogin();
      }
    });

    // 4) 현재 세션 체크
    const session = await Auth.getSession();
    if (session) {
      UI.renderApp();
      this._bindNav();
      await this.navigate('dashboard');
      this._setupRealtime();
    } else {
      UI.renderLogin();
    }
  },

  // ── Supabase 미설정 경고 ──────────────────────────────
  _showConfigWarning() {
    document.body.innerHTML = `
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#faf8f4;padding:40px;text-align:center;font-family:'Noto Sans KR',sans-serif;">
  <div style="font-size:40px;margin-bottom:16px;">⚙️</div>
  <h1 style="font-family:'Noto Serif KR',serif;color:#2c2220;margin-bottom:12px;">Supabase 설정이 필요합니다</h1>
  <p style="color:#8a7060;max-width:500px;line-height:1.8;margin-bottom:24px;">
    <code>assets/js/supabase.js</code> 파일에서<br>
    <code>SUPABASE_URL</code>과 <code>SUPABASE_ANON_KEY</code>를 본인 Supabase 프로젝트 값으로 교체하세요.
  </p>
  <div style="background:#fff;border:1px solid #e8dcc8;border-radius:8px;padding:20px 28px;text-align:left;font-size:13px;color:#5a3e28;max-width:500px;width:100%;">
    <div style="margin-bottom:8px;"><strong>1.</strong> <a href="https://supabase.com" target="_blank" style="color:#c9a96e;">supabase.com</a> 에서 새 프로젝트 생성</div>
    <div style="margin-bottom:8px;"><strong>2.</strong> Project Settings → API 에서 URL / anon key 복사</div>
    <div style="margin-bottom:8px;"><strong>3.</strong> <code>supabase.js</code> 상단의 두 변수 값 교체</div>
    <div><strong>4.</strong> SQL Editor에서 <code>sql/schema.sql</code> 실행</div>
  </div>
  <p style="margin-top:20px;color:#aaa;font-size:12px;">자세한 내용은 README.md를 참고하세요.</p>
</div>`;
  },

  // ── 로그인 폼 바인딩 ────────────────────────────────
  _bindLoginForm() {
    const loginBtn = document.getElementById('login-btn');
    const loginForm = document.getElementById('login-form');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email')?.value?.trim();
        const pw = document.getElementById('login-password')?.value;
        if (!email || !pw) { UI.toast('이메일과 비밀번호를 입력하세요.', 'error'); return; }
        loginBtn.disabled = true;
        loginBtn.textContent = '로그인 중...';
        try {
          await Auth.signIn(email, pw);
        } catch(e) {
          UI.toast('로그인 실패: ' + (e.message || '이메일 또는 비밀번호를 확인하세요.'), 'error');
          loginBtn.disabled = false;
          loginBtn.textContent = '로그인';
        }
      });
    }
    // Enter 키 로그인
    document.getElementById('login-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') loginBtn?.click();
    });
    // 비밀번호 초기화 링크
    document.getElementById('reset-pw-link')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value?.trim();
      if (!email) { UI.toast('이메일을 먼저 입력하세요.', 'error'); return; }
      try {
        await Auth.resetPassword(email);
        UI.toast('비밀번호 초기화 이메일이 발송되었습니다.');
      } catch(err) { UI.toast('발송 실패: ' + err.message, 'error'); }
    });
  },

  // ── 네비게이션 바인딩 ────────────────────────────────
  _bindNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const menuId = el.dataset.menu;
        if (menuId) this.navigate(menuId);
      });
    });
    // 로그아웃
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      if (!confirm('로그아웃하시겠습니까?')) return;
      try {
        await Auth.signOut();
        UI.toast('로그아웃되었습니다.');
      } catch(e) { UI.toast('로그아웃 실패', 'error'); }
    });
    // JSON 가져오기는 관리자만 (향후 확장용)
  },

  // ── 뷰 네비게이션 ────────────────────────────────────
  async navigate(view) {
    document.querySelectorAll('.view-panel').forEach(el => el.style.display = 'none');
    const panel = document.getElementById(`view-${view}`);
    if (!panel) return;
    panel.style.display = 'block';
    UI.setActive(view);
    this.currentView = view;
    document.getElementById('main-content')?.scrollTo(0, 0);

    switch (view) {
      case 'dashboard':  await UI.renderDashboard(); break;
      case 'roadmap':    await UI.renderRoadmap(); break;
      case 'tasks':      await UI.renderTasks(); break;
      case 'documents':  await UI.renderDocuments(); break;
      case 'collab':     await UI.renderCollabs(); break;
      case 'admin':      await UI.renderAdmin(); break;
    }
  },

  refreshCurrentView() { this.navigate(this.currentView); },

  // ════════════════════════════════════════════════════
  // Realtime 구독
  // ════════════════════════════════════════════════════
  _setupRealtime() {
    // tasks 변경 → 현재 뷰 새로고침
    Realtime.subscribe('tasks', (payload) => {
      console.log('Realtime tasks:', payload.eventType);
      if (['roadmap','tasks','dashboard'].includes(this.currentView)) {
        // 디바운스 (1초)
        clearTimeout(this._realtimeTimer);
        this._realtimeTimer = setTimeout(() => this.navigate(this.currentView), 1000);
      }
    });
    // collaborations 변경
    Realtime.subscribe('collaborations', (payload) => {
      if (['collab','tasks','roadmap'].includes(this.currentView)) {
        clearTimeout(this._realtimeTimer2);
        this._realtimeTimer2 = setTimeout(() => this.navigate(this.currentView), 1000);
      }
    });
    // documents 변경
    Realtime.subscribe('documents', (payload) => {
      if (this.currentView === 'documents') {
        clearTimeout(this._realtimeTimer3);
        this._realtimeTimer3 = setTimeout(() => UI.renderDocuments(), 1500);
      }
      // 대시보드 산출물 완료 수 업데이트
      if (this.currentView === 'dashboard') {
        clearTimeout(this._realtimeTimer4);
        this._realtimeTimer4 = setTimeout(() => UI.renderDashboard(), 2000);
      }
    });
    // comments 변경
    Realtime.subscribe('comments', (payload) => {
      // 열린 모달의 댓글 실시간 갱신
      const tid = payload.new?.target_id || payload.old?.target_id;
      const ttype = payload.new?.target_type || payload.old?.target_type;
      if (tid && ttype) {
        const container = document.getElementById(`comments-${ttype}-${tid}`);
        if (container) {
          API.getComments(ttype, tid).then(comments => {
            container.innerHTML = UI._buildComments(comments, ttype, tid);
          });
        }
      }
    });
  },

  // ════════════════════════════════════════════════════
  // 전체 내보내기 헬퍼
  // ════════════════════════════════════════════════════
  async exportAllPDF() {
    const [tasks, docs] = await Promise.all([API.getTasks(), API.getDocuments()]);
    await Exporter.exportAllPDF(tasks, docs);
  },
  async exportAllWord() {
    const [tasks, docs] = await Promise.all([API.getTasks(), API.getDocuments()]);
    await Exporter.exportAllWord(tasks, docs);
  },
  async exportRoadmapPDF() {
    const tasks = await API.getTasks();
    await Exporter.exportRoadmapPDF(tasks);
  },
  async exportJSON() {
    const [tasks, docs, collabs] = await Promise.all([API.getTasks(), API.getDocuments(), API.getCollaborations()]);
    await Exporter.exportJSON(tasks, docs, collabs);
  }
};

// ── DOMContentLoaded 후 앱 시작 ─────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
