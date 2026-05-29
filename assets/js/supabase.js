// ════════════════════════════════════════════════════════
// supabase.js — Supabase 클라이언트 초기화 & 인증 모듈
// ★ SUPABASE_URL과 SUPABASE_ANON_KEY를 본인 프로젝트 값으로 교체하세요
// ════════════════════════════════════════════════════════

// ── Supabase 설정 (환경별 변경 필요) ────────────────────
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';       // 예: https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';  // 예: eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...

// ── 클라이언트 생성 ──────────────────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
});

// ════════════════════════════════════════════════════════
// Auth 모듈
// ════════════════════════════════════════════════════════
const Auth = {
  currentUser: null,
  currentProfile: null,

  // ── 로그인 ─────────────────────────────────────────────
  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.loadProfile(data.user.id);
    return data.user;
  },

  // ── 로그아웃 ───────────────────────────────────────────
  async signOut() {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
    this.currentProfile = null;
    Cache.clear();
  },

  // ── 비밀번호 초기화 이메일 ─────────────────────────────
  async resetPassword(email) {
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
  },

  // ── 현재 세션 확인 ─────────────────────────────────────
  async getSession() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadProfile(session.user.id);
    }
    return session;
  },

  // ── 프로필 로드 ────────────────────────────────────────
  async loadProfile(userId) {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      this.currentProfile = data;
    }
    return this.currentProfile;
  },

  // ── 권한 체크 ──────────────────────────────────────────
  get role() { return this.currentProfile?.role || 'viewer'; },
  get isAdmin() { return this.role === 'admin'; },
  get isBrandManager() { return this.role === 'brand_manager'; },
  get isMember() { return this.role === 'member'; },
  get isViewer() { return this.role === 'viewer'; },
  get canEdit() { return ['admin','brand_manager','member'].includes(this.role); },
  get canManageAll() { return ['admin','brand_manager'].includes(this.role); },
  get canExport() { return ['admin','brand_manager','member','viewer'].includes(this.role); },
  get canDeleteDoc() { return ['admin'].includes(this.role); },

  canEditTask(task) {
    if (!this.currentProfile) return false;
    if (this.canManageAll) return true;
    return task.owner_id === this.currentProfile.id || task.writer_id === this.currentProfile.id;
  },
  canEditDoc(doc) {
    if (!this.currentProfile) return false;
    if (this.canManageAll) return true;
    return doc.writer_id === this.currentProfile.id;
  },

  // ── Auth 상태 변경 리스너 ──────────────────────────────
  onAuthStateChange(callback) {
    return db.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        this.currentUser = session.user;
        await this.loadProfile(session.user.id);
      } else {
        this.currentUser = null;
        this.currentProfile = null;
      }
      callback(event, session);
    });
  }
};

// ════════════════════════════════════════════════════════
// localStorage 캐시 (보조용)
// ════════════════════════════════════════════════════════
const Cache = {
  KEY: 'geumunmi_cache',
  TTL: 5 * 60 * 1000, // 5분

  set(key, value) {
    try {
      const store = this._load();
      store[key] = { value, ts: Date.now() };
      localStorage.setItem(this.KEY, JSON.stringify(store));
    } catch(e) {}
  },
  get(key) {
    try {
      const store = this._load();
      const item = store[key];
      if (!item) return null;
      if (Date.now() - item.ts > this.TTL) { delete store[key]; return null; }
      return item.value;
    } catch(e) { return null; }
  },
  invalidate(key) {
    try {
      const store = this._load();
      delete store[key];
      localStorage.setItem(this.KEY, JSON.stringify(store));
    } catch(e) {}
  },
  clear() {
    try { localStorage.removeItem(this.KEY); } catch(e) {}
  },
  _load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch(e) { return {}; }
  }
};
