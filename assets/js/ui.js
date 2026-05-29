// ════════════════════════════════════════════════════════
// ui.js — UI 렌더링 & 인터랙션 (Supabase 데이터 기반)
// ════════════════════════════════════════════════════════

const UI = {
  // ── 앱 전역 상태 ────────────────────────────────────
  state: {
    tasks: [], documents: [], collaborations: [],
    users: [], comments: {}
  },

  // ════════════════════════════════════════════════════
  // 공통 유틸
  // ════════════════════════════════════════════════════
  statusCls(s) {
    return { '예정':'status-scheduled','진행 중':'status-inprogress','검토 필요':'status-review',
             '수정 중':'status-revising','완료':'status-done','보류':'status-hold' }[s] || '';
  },
  priorityCls(p) { return { '높음':'priority-high','보통':'priority-medium','낮음':'priority-low' }[p] || ''; },
  collabCls(s) {
    return { '요청 전':'collab-before','요청 완료':'collab-sent','회신 대기':'collab-waiting',
             '진행 중':'collab-inprogress','완료':'collab-done','보류':'collab-hold' }[s] || '';
  },
  fmtDate(d) {
    if (!d) return '-';
    const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`;
  },
  fmtDateTime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  },
  esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; },

  toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
  },

  showLoading(msg = '로딩 중...') {
    let el = document.getElementById('global-loading');
    if (!el) {
      el = document.createElement('div'); el.id = 'global-loading'; el.className = 'global-loading';
      document.body.appendChild(el);
    }
    el.textContent = msg; el.style.display = 'flex';
  },
  hideLoading() {
    const el = document.getElementById('global-loading');
    if (el) el.style.display = 'none';
  },

  setActive(menuId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const el = document.querySelector(`[data-menu="${menuId}"]`);
    if (el) el.classList.add('active');
  },

  // 권한별 메뉴 표시
  applyRoleVisibility() {
    const role = Auth.role;
    document.querySelectorAll('[data-role]').forEach(el => {
      const allowed = el.dataset.role.split(',');
      el.style.display = allowed.includes(role) ? '' : 'none';
    });
    // 편집 버튼 숨기기 (viewer)
    if (role === 'viewer') {
      document.querySelectorAll('.edit-only').forEach(el => el.style.display = 'none');
    }
  },

  // ════════════════════════════════════════════════════
  // 로그인 화면
  // ════════════════════════════════════════════════════
  renderLogin() {
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  },

  renderApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
    this.updateUserInfo();
    this.applyRoleVisibility();
  },

  updateUserInfo() {
    const p = Auth.currentProfile;
    if (!p) return;
    const el = document.getElementById('current-user-info');
    if (el) el.innerHTML = `
      <div class="user-avatar">${p.name.charAt(0)}</div>
      <div class="user-details">
        <div class="user-name">${p.name}</div>
        <div class="user-role">${this._roleLabel(p.role)}</div>
      </div>`;
  },

  _roleLabel(role) {
    return { admin:'관리자', brand_manager:'브랜딩 총괄', member:'팀원', viewer:'조회자' }[role] || role;
  },

  // ════════════════════════════════════════════════════
  // 대시보드
  // ════════════════════════════════════════════════════
  async renderDashboard() {
    const container = document.getElementById('view-dashboard');
    container.innerHTML = '<div class="page-loading">데이터를 불러오는 중...</div>';
    try {
      const [tasks, documents] = await Promise.all([API.getTasks(), API.getDocuments()]);
      this.state.tasks = tasks; this.state.documents = documents;
      const stats = await API.getStats(tasks, documents);
      const users = await API.getUsers(); this.state.users = users;

      const teamCards = users.map(u => {
        const count = stats.byAssignee[u.name] || 0;
        return `<div class="team-card">
          <div class="team-avatar">${u.name.charAt(0)}</div>
          <div class="team-info">
            <div class="team-name">${u.name} <span class="team-role">${u.position||''}</span></div>
            <div class="team-stat">담당 <strong>${count}</strong>건 · <span class="badge ${this.statusCls('완료')}">${this._roleLabel(u.role)}</span></div>
          </div>
        </div>`;
      }).join('');

      const thisWeekHTML = stats.thisWeekTasks.length
        ? stats.thisWeekTasks.slice(0,6).map(t => `
          <div class="week-task-item">
            <span class="badge ${this.statusCls(t.status)}">${t.status}</span>
            <span class="task-name">${t.title}</span>
            <span class="task-assignee">${t.owner?.name||'미배정'}</span>
            <span class="task-due">${this.fmtDate(t.due_date)}</span>
          </div>`).join('')
        : '<div class="empty-state">이번 주 마감 업무가 없습니다.</div>';

      const delayed = tasks.filter(t => {
        if (t.status === '완료') return false;
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date();
      });
      const delayedHTML = delayed.length
        ? delayed.slice(0,5).map(t => `
          <div class="week-task-item delayed">
            <span class="badge ${this.statusCls(t.status)}">${t.status}</span>
            <span class="task-name">${t.title}</span>
            <span class="task-assignee">${t.owner?.name||'미배정'}</span>
            <span class="task-due overdue">${this.fmtDate(t.due_date)}</span>
          </div>`).join('')
        : '<div class="empty-state success-state">지연된 업무가 없습니다 ✓</div>';

      container.innerHTML = `
<div class="dashboard-header">
  <div class="page-title">
    <div class="page-title-en">Dashboard</div>
    <h1>대시보드</h1>
    <p class="page-subtitle">금은미 브랜딩 프로젝트 · 2025년 6월 전체 현황</p>
  </div>
  <div class="dashboard-core-msg">
    <span class="core-msg-label">핵심 메시지</span>
    <span class="core-msg-text">"하루의 끝, 나에게 닿는 빛"</span>
  </div>
</div>
<div class="stat-cards">
  <div class="stat-card stat-primary">
    <div class="stat-label">전체 진행률</div>
    <div class="stat-value">${stats.progress}<span class="stat-unit">%</span></div>
    <div class="progress-bar-wrap"><div class="progress-bar" style="width:${stats.progress}%"></div></div>
    <div class="stat-sub">${stats.completed} / ${stats.total} 완료</div>
  </div>
  <div class="stat-card"><div class="stat-label">전체 업무</div><div class="stat-value">${stats.total}<span class="stat-unit">건</span></div></div>
  <div class="stat-card"><div class="stat-label">진행 중</div><div class="stat-value stat-blue">${stats.inProgress}<span class="stat-unit">건</span></div></div>
  <div class="stat-card"><div class="stat-label">지연됨</div><div class="stat-value stat-red">${stats.delayed}<span class="stat-unit">건</span></div></div>
  <div class="stat-card"><div class="stat-label">완료 산출물</div><div class="stat-value stat-green">${stats.docsCompleted}<span class="stat-unit">개</span></div></div>
  <div class="stat-card"><div class="stat-label">협업 요청</div><div class="stat-value stat-orange">${stats.collabNeeded}<span class="stat-unit">건</span></div></div>
</div>
<div class="dashboard-grid">
  <div class="dashboard-panel"><div class="panel-header"><h3>이번 주 핵심 업무</h3><span class="panel-count">${stats.thisWeekTasks.length}건</span></div><div class="panel-body">${thisWeekHTML}</div></div>
  <div class="dashboard-panel"><div class="panel-header"><h3>지연된 업무</h3><span class="panel-count ${delayed.length>0?'count-red':''}">${delayed.length}건</span></div><div class="panel-body">${delayedHTML}</div></div>
</div>
<div class="dashboard-panel full-width"><div class="panel-header"><h3>팀원 현황</h3></div><div class="team-cards">${teamCards}</div></div>`;
    } catch(e) { container.innerHTML = `<div class="error-state">데이터 로드 실패: ${e.message}</div>`; }
  },

  // ════════════════════════════════════════════════════
  // 로드맵
  // ════════════════════════════════════════════════════
  async renderRoadmap() {
    const container = document.getElementById('view-roadmap');
    container.innerHTML = '<div class="page-loading">로드맵을 불러오는 중...</div>';
    try {
      const tasks = await API.getTasks(); this.state.tasks = tasks;
      const WEEKS = [
        { n:1, title:'브랜드 진단 & 방향성 정리', period:'6월 2~6일', goal:'기존 브랜드 현황 파악 및 경쟁 분석을 통해 방향성 초안 도출', checkpoints:['경쟁 브랜드 분석 완료','타겟 고객 정의 완료','브랜드 방향성 초안 합의'], outputs:['브랜드 현황 진단','경쟁 브랜드 분석','타겟 페르소나'] },
        { n:2, title:'브랜드 전략 & 메시지 확정', period:'6월 9~13일', goal:'브랜드 정체성 구체화 및 핵심 메시지·슬로건 확정', checkpoints:['슬로건 최종 확정','브랜드 소개문 완성','페르소나 문서 완성'], outputs:['브랜드 정체성 문장','슬로건 / 서브 카피','브랜드 소개문'] },
        { n:3, title:'비주얼 브랜딩 & 상품 표현 구조 정리', period:'6월 16~20일', goal:'브랜드 무드·비주얼 방향 구체화 및 촬영 가이드·상세페이지 구조 정립', checkpoints:['무드보드 승인','촬영 가이드 완성','상세페이지 구조 확정'], outputs:['브랜드 무드보드','촬영 가이드','상세페이지 구조안'] },
        { n:4, title:'채널별 실행 전략 정리', period:'6월 23~27일', goal:'자사몰·인스타·카카오·Meta 채널별 실행 전략 구체화', checkpoints:['채널별 실행안 완성','카카오 선물하기 준비 현황','7월 콘텐츠 리스트 완성'], outputs:['인스타그램 운영안','자사몰 개편 방향','카카오 입점 준비안','Meta 광고 기획안'] },
        { n:5, title:'최종 정리 & 7월 실행 준비', period:'6월 30일', goal:'전체 브랜딩 문서 통합 및 7월 실행 준비 완료', checkpoints:['전체 문서 통합 완료','7월 실행 계획 확정','최종 산출물 내보내기 완료'], outputs:['7월 실행 리스트','최종 통합 문서'] },
      ];
      const weekTabs = WEEKS.map((w,i) => `<button class="week-tab ${i===0?'active':''}" onclick="UI.switchWeek(${w.n},this)">W${w.n} ${w.title.split(' ')[0]}</button>`).join('');
      const weekContents = WEEKS.map((w,i) => {
        const wTasks = tasks.filter(t => t.week === w.n);
        const rows = wTasks.map(t => `
          <tr>
            <td class="task-name-cell">${this.esc(t.title)}</td>
            <td>${this.fmtDate(t.start_date)}</td>
            <td>${this.fmtDate(t.due_date)}</td>
            <td><span class="assignee-badge">${this.esc(t.owner?.name||'미배정')}</span></td>
            <td><span class="badge ${this.priorityCls(t.priority)}">${t.priority}</span></td>
            <td>
              <select class="inline-select status-select" ${Auth.canEditTask(t)?'':'disabled'}
                onchange="UI.quickUpdateStatus('${t.id}',this.value)">
                ${['예정','진행 중','검토 필요','수정 중','완료','보류'].map(s=>`<option value="${s}" ${t.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </td>
            <td>${this.esc(t.output_type||'-')}</td>
            <td>
              <button class="btn-collab ${t.collaboration_required?'collab-active':''}" onclick="UI.openCollabModal('${t.id}')">
                ${t.collaboration_required?'✓ 요청':'협업'}
              </button>
            </td>
            <td><button class="btn-detail" onclick="UI.openTaskDetail('${t.id}')">상세</button></td>
          </tr>`).join('');
        const checkpoints = w.checkpoints.map(c=>`<li>${c}</li>`).join('');
        const outputs = w.outputs.map(o=>`<span class="output-tag">${o}</span>`).join('');
        return `<div class="week-content ${i===0?'active':''}" id="week-panel-${w.n}">
          <div class="week-header">
            <div class="week-title-wrap">
              <div class="week-period">${w.period}</div>
              <h2 class="week-title">${w.title}</h2>
              <p class="week-goal">${w.goal}</p>
            </div>
            <div class="week-meta"><div class="week-outputs"><strong>주요 산출물</strong><br>${outputs}</div></div>
          </div>
          <div class="table-wrap">
            <table class="task-table">
              <thead><tr><th>업무명</th><th>시작일</th><th>마감일</th><th>담당자</th><th>우선순위</th><th>상태</th><th>산출물 유형</th><th>협업</th><th></th></tr></thead>
              <tbody>${rows||'<tr><td colspan="9" class="empty-state">이번 주 업무가 없습니다.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="checkpoint-box"><div class="checkpoint-title">✓ 주차 체크포인트</div><ul class="checkpoint-list">${checkpoints}</ul></div>
          <div class="week-export-bar edit-only">
            <button class="btn-sm btn-outline" onclick="App.exportRoadmapPDF()"><span>📄</span> 로드맵 PDF</button>
          </div>
        </div>`;
      }).join('');

      container.innerHTML = `
<div class="page-header">
  <div class="page-title-en">Roadmap</div>
  <h1>6월 로드맵</h1>
  <p class="page-subtitle">주차별 브랜딩 업무 현황 — 상태를 바로 수정할 수 있습니다.</p>
</div>
<div class="week-tabs">${weekTabs}</div>
<div class="week-contents">${weekContents}</div>`;
      this.applyRoleVisibility();
    } catch(e) { container.innerHTML = `<div class="error-state">로드 실패: ${e.message}</div>`; }
  },

  switchWeek(n, btn) {
    document.querySelectorAll('.week-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.week-content').forEach(c=>c.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById(`week-panel-${n}`)?.classList.add('active');
  },

  async quickUpdateStatus(taskId, status) {
    try {
      await API.updateTask(taskId, { status });
      this.toast(`상태 → "${status}"`);
    } catch(e) { this.toast('업데이트 실패: ' + e.message, 'error'); }
  },

  // ════════════════════════════════════════════════════
  // 업무 관리
  // ════════════════════════════════════════════════════
  async renderTasks(filter = {}) {
    const container = document.getElementById('view-tasks');
    container.innerHTML = '<div class="page-loading">업무 목록을 불러오는 중...</div>';
    try {
      let tasks = await API.getTasks(); this.state.tasks = tasks;
      const users = await API.getUsers(); this.state.users = users;
      if (filter.week) tasks = tasks.filter(t => t.week == filter.week);
      if (filter.owner) tasks = tasks.filter(t => t.owner?.name === filter.owner);
      if (filter.status) tasks = tasks.filter(t => t.status === filter.status);
      if (filter.search) tasks = tasks.filter(t => t.title.includes(filter.search));

      const userOpts = users.map(u=>`<option value="${u.name}">${u.name}</option>`).join('');
      const rows = tasks.map(t => `
        <tr>
          <td class="task-name-cell">${this.esc(t.title)}</td>
          <td>W${t.week}</td>
          <td>${this.fmtDate(t.start_date)}</td>
          <td>${this.fmtDate(t.due_date)}</td>
          <td>
            <select class="inline-select" ${Auth.canManageAll||t.owner_id===Auth.currentProfile?.id?'':'disabled'}
              onchange="UI.patchTask('${t.id}',{owner_id:this.options[this.selectedIndex].dataset.uid})">
              ${users.map(u=>`<option value="${u.name}" data-uid="${u.id}" ${t.owner?.id===u.id?'selected':''}>${u.name}</option>`).join('')}
            </select>
          </td>
          <td>
            <select class="inline-select" ${Auth.canManageAll?'':'disabled'}
              onchange="UI.patchTask('${t.id}',{writer_id:this.options[this.selectedIndex].dataset.uid})">
              ${users.map(u=>`<option value="${u.name}" data-uid="${u.id}" ${t.writer?.id===u.id?'selected':''}>${u.name}</option>`).join('')}
            </select>
          </td>
          <td>
            <select class="inline-select ${this.priorityCls(t.priority)}" ${Auth.canEditTask(t)?'':'disabled'}
              onchange="UI.patchTask('${t.id}',{priority:this.value})">
              ${['높음','보통','낮음'].map(p=>`<option value="${p}" ${t.priority===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </td>
          <td>
            <select class="inline-select status-select" ${Auth.canEditTask(t)?'':'disabled'}
              onchange="UI.patchTask('${t.id}',{status:this.value})">
              ${['예정','진행 중','검토 필요','수정 중','완료','보류'].map(s=>`<option value="${s}" ${t.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </td>
          <td>${this.esc(t.output_type||'-')}</td>
          <td class="center"><span class="collab-dot ${t.collaboration_required?'collab-y':'collab-n'}">${t.collaboration_required?'필요':'없음'}</span></td>
          <td class="note-cell">${this.esc(t.memo||'')}</td>
          <td>
            <button class="btn-sm btn-outline" onclick="UI.openTaskDetail('${t.id}')">상세</button>
            <button class="btn-sm btn-collab-sm ${t.collaboration_required?'collab-active':''}" onclick="UI.openCollabModal('${t.id}')">협업</button>
          </td>
        </tr>`).join('');

      container.innerHTML = `
<div class="page-header">
  <div class="page-title-en">Tasks</div>
  <h1>업무 관리</h1>
  <p class="page-subtitle">전체 ${tasks.length}건 · 권한에 따라 수정 가능합니다.</p>
</div>
<div class="filter-bar">
  <input type="text" class="filter-input" placeholder="🔍 업무명 검색..." oninput="UI.renderTasks({search:this.value})">
  <select class="filter-select" onchange="UI.renderTasks({week:this.value||undefined})">
    <option value="">전체 주차</option>
    ${[1,2,3,4,5].map(w=>`<option value="${w}">${w}주차</option>`).join('')}
  </select>
  <select class="filter-select" onchange="UI.renderTasks({owner:this.value||undefined})">
    <option value="">전체 담당자</option>
    ${users.map(u=>`<option value="${u.name}">${u.name}</option>`).join('')}
  </select>
  <select class="filter-select" onchange="UI.renderTasks({status:this.value||undefined})">
    <option value="">전체 상태</option>
    ${['예정','진행 중','검토 필요','수정 중','완료','보류'].map(s=>`<option value="${s}">${s}</option>`).join('')}
  </select>
  <span class="filter-count">총 ${tasks.length}건</span>
</div>
<div class="table-wrap scroll-x">
  <table class="task-table task-manage-table">
    <thead>
      <tr><th style="min-width:180px">업무명</th><th>주차</th><th>시작일</th><th>마감일</th>
      <th>담당자</th><th>작성자</th><th>우선순위</th><th>상태</th>
      <th>산출물 유형</th><th>협업 필요</th><th style="min-width:120px">비고</th><th style="min-width:120px">액션</th></tr>
    </thead>
    <tbody>${rows||'<tr><td colspan="12" class="empty-state">업무가 없습니다.</td></tr>'}</tbody>
  </table>
</div>`;
    } catch(e) { container.innerHTML = `<div class="error-state">로드 실패: ${e.message}</div>`; }
  },

  async patchTask(id, fields) {
    try {
      await API.updateTask(id, fields);
      this.toast('저장되었습니다.');
    } catch(e) { this.toast('저장 실패: ' + e.message, 'error'); }
  },

  // ════════════════════════════════════════════════════
  // 업무 상세 모달
  // ════════════════════════════════════════════════════
  async openTaskDetail(taskId) {
    const modal = document.getElementById('modal-task');
    const body = document.getElementById('modal-task-body');
    body.innerHTML = '<div class="page-loading">불러오는 중...</div>';
    modal.classList.add('open'); document.body.classList.add('modal-open');
    try {
      const [task, users, histories, comments] = await Promise.all([
        API.getTasks().then(ts => ts.find(t => t.id === taskId)),
        API.getUsers(),
        API.getTaskHistories(taskId),
        API.getComments('task', taskId)
      ]);
      if (!task) { body.innerHTML = '<div class="error-state">업무를 찾을 수 없습니다.</div>'; return; }
      const canEdit = Auth.canEditTask(task);
      const userOpts = users.map(u=>`<option value="${u.id}" ${task.owner?.id===u.id?'selected':''}>${u.name}</option>`).join('');
      const writerOpts = users.map(u=>`<option value="${u.id}" ${task.writer?.id===u.id?'selected':''}>${u.name}</option>`).join('');
      const historyRows = histories.slice(0,10).map(h=>`
        <div class="history-item">
          <span class="history-field">${this._fieldLabel(h.changed_field)}</span>
          <span class="history-arrow">${this.esc(h.old_value||'없음')} → <strong>${this.esc(h.new_value||'없음')}</strong></span>
          <span class="history-by">${h.changed_by_user?.name||'시스템'} · ${this.fmtDateTime(h.changed_at)}</span>
        </div>`).join('') || '<div class="empty-state">수정 이력이 없습니다.</div>';
      const commentsHTML = this._buildComments(comments, 'task', taskId);
      body.innerHTML = `
<div class="task-detail-header">
  <div class="task-detail-week">W${task.week} — ${task.due_date||'날짜 미정'}</div>
  <h2 class="task-detail-title">${this.esc(task.title)}</h2>
</div>
<div class="task-detail-grid">
  <div class="detail-group"><label>담당자</label>
    <select class="detail-select" ${canEdit?'':'disabled'} onchange="UI.patchTask('${taskId}',{owner_id:this.value})">${userOpts}</select>
  </div>
  <div class="detail-group"><label>작성자</label>
    <select class="detail-select" ${Auth.canManageAll?'':'disabled'} onchange="UI.patchTask('${taskId}',{writer_id:this.value})">${writerOpts}</select>
  </div>
  <div class="detail-group"><label>시작일</label>
    <input type="date" class="detail-input" value="${task.start_date||''}" ${canEdit?'':'disabled'} onchange="UI.patchTask('${taskId}',{start_date:this.value})">
  </div>
  <div class="detail-group"><label>마감일</label>
    <input type="date" class="detail-input" value="${task.due_date||''}" ${canEdit?'':'disabled'} onchange="UI.patchTask('${taskId}',{due_date:this.value})">
  </div>
  <div class="detail-group"><label>우선순위</label>
    <select class="detail-select" ${canEdit?'':'disabled'} onchange="UI.patchTask('${taskId}',{priority:this.value})">
      ${['높음','보통','낮음'].map(p=>`<option value="${p}" ${task.priority===p?'selected':''}>${p}</option>`).join('')}
    </select>
  </div>
  <div class="detail-group"><label>진행 상태</label>
    <select class="detail-select" ${canEdit?'':'disabled'} onchange="UI.patchTask('${taskId}',{status:this.value})">
      ${['예정','진행 중','검토 필요','수정 중','완료','보류'].map(s=>`<option value="${s}" ${task.status===s?'selected':''}>${s}</option>`).join('')}
    </select>
  </div>
  <div class="detail-group"><label>산출물 유형</label>
    <input type="text" class="detail-input" value="${this.esc(task.output_type||'')}" ${canEdit?'':'disabled'} onchange="UI.patchTask('${taskId}',{output_type:this.value})">
  </div>
  <div class="detail-group"><label>비고</label>
    <input type="text" class="detail-input" value="${this.esc(task.memo||'')}" ${canEdit?'':'disabled'} onchange="UI.patchTask('${taskId}',{memo:this.value})">
  </div>
</div>
<div class="detail-meta-row">
  <span>최종 수정자: <strong>${task.updated_by_user?.name||'-'}</strong></span>
  <span>수정일: <strong>${this.fmtDateTime(task.updated_at)}</strong></span>
</div>
${Auth.canEdit ? `<div class="collab-section-action edit-only">
  <button class="btn-primary btn-sm" onclick="UI.openCollabModal('${taskId}')">협업 요청 등록/수정</button>
</div>` : ''}
<div class="history-section">
  <div class="section-title">수정 이력</div>
  ${historyRows}
</div>
<div class="comments-section">
  <div class="section-title">댓글 / 피드백</div>
  <div id="comments-task-${taskId}">${commentsHTML}</div>
  ${Auth.canEdit ? `<div class="comment-input-row">
    <input type="text" class="comment-input" id="comment-input-task-${taskId}" placeholder="댓글을 입력하세요...">
    <button class="btn-primary btn-sm" onclick="UI.addComment('task','${taskId}')">등록</button>
  </div>` : ''}
</div>`;
    } catch(e) { body.innerHTML = `<div class="error-state">오류: ${e.message}</div>`; }
  },

  closeTaskModal() { document.getElementById('modal-task').classList.remove('open'); document.body.classList.remove('modal-open'); },

  _fieldLabel(field) {
    const map = { title:'업무명', status:'상태', priority:'우선순위', owner_id:'담당자', writer_id:'작성자',
      start_date:'시작일', due_date:'마감일', output_type:'산출물 유형', memo:'비고', collaboration_required:'협업 여부' };
    return map[field] || field;
  },

  // ════════════════════════════════════════════════════
  // 협업 요청 모달
  // ════════════════════════════════════════════════════
  async openCollabModal(taskId) {
    if (!Auth.canEdit) { this.toast('협업 요청은 팀원 이상만 가능합니다.', 'error'); return; }
    const modal = document.getElementById('modal-collab');
    const tasks = this.state.tasks.length ? this.state.tasks : await API.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const collab = await API.getCollaborationByTask(taskId);
    document.getElementById('collab-task-id').value = taskId;
    document.getElementById('collab-task-name').textContent = task.title;
    document.getElementById('collab-dept').value = collab?.request_department || '';
    document.getElementById('collab-person').value = collab?.request_person || '';
    document.getElementById('collab-content').value = collab?.request_content || '';
    document.getElementById('collab-due').value = collab?.request_due_date || '';
    document.getElementById('collab-link').value = collab?.reference_link || '';
    document.getElementById('collab-status').value = collab?.request_status || '요청 전';
    modal.classList.add('open'); document.body.classList.add('modal-open');
  },

  async saveCollabModal() {
    const taskId = document.getElementById('collab-task-id').value;
    const fields = {
      request_department: document.getElementById('collab-dept').value,
      request_person: document.getElementById('collab-person').value,
      request_content: document.getElementById('collab-content').value,
      request_due_date: document.getElementById('collab-due').value || null,
      reference_link: document.getElementById('collab-link').value,
      request_status: document.getElementById('collab-status').value,
    };
    try {
      await API.upsertCollaboration(taskId, fields);
      this.closeCollabModal();
      this.toast('협업 요청이 저장되었습니다.');
      App.refreshCurrentView();
    } catch(e) { this.toast('저장 실패: ' + e.message, 'error'); }
  },

  closeCollabModal() { document.getElementById('modal-collab').classList.remove('open'); document.body.classList.remove('modal-open'); },

  // ════════════════════════════════════════════════════
  // 협업 요청 목록 뷰
  // ════════════════════════════════════════════════════
  async renderCollabs() {
    const container = document.getElementById('view-collab');
    container.innerHTML = '<div class="page-loading">협업 요청을 불러오는 중...</div>';
    try {
      const collabs = await API.getCollaborations();
      const rows = collabs.map(c => `
        <tr>
          <td>${this.esc(c.task?.title||'-')}</td>
          <td>W${c.task?.week||'-'}</td>
          <td>${this.esc(c.request_department||'-')}</td>
          <td>${this.esc(c.request_person||'-')}</td>
          <td class="collab-content-td">${this.esc(c.request_content||'-')}</td>
          <td>${c.request_due_date||'-'}</td>
          <td><span class="badge ${this.collabCls(c.request_status)}">${c.request_status||'요청 전'}</span></td>
          <td>${this.esc(c.creator?.name||'-')}</td>
          <td>${c.reference_link?`<a href="${this.esc(c.reference_link)}" target="_blank" rel="noopener">링크</a>`:'-'}</td>
          <td>${Auth.canEdit?`<button class="btn-sm btn-outline" onclick="UI.openCollabModal('${c.task_id}')">수정</button>`:''}
          </td>
        </tr>`).join('');
      container.innerHTML = `
<div class="page-header">
  <div class="page-title-en">Collaboration</div>
  <h1>협업 요청 관리</h1>
  <p class="page-subtitle">타부서 협업 요청 현황 (${collabs.length}건)</p>
</div>
<div class="table-wrap scroll-x">
  <table class="task-table">
    <thead><tr><th>업무명</th><th>주차</th><th>요청 부서</th><th>요청 담당자</th><th>요청 내용</th><th>마감일</th><th>상태</th><th>등록자</th><th>링크</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="10" class="empty-state">협업 요청이 없습니다.</td></tr>'}</tbody>
  </table>
</div>`;
    } catch(e) { container.innerHTML = `<div class="error-state">로드 실패: ${e.message}</div>`; }
  },

  // ════════════════════════════════════════════════════
  // 산출물 목록 뷰
  // ════════════════════════════════════════════════════
  async renderDocuments() {
    const container = document.getElementById('view-documents');
    container.innerHTML = '<div class="page-loading">산출물을 불러오는 중...</div>';
    try {
      const [docs, tasks] = await Promise.all([API.getDocuments(), API.getTasks()]);
      this.state.documents = docs; this.state.tasks = tasks;
      const completed = docs.filter(d=>d.is_completed).length;
      const cards = docs.map(doc => {
        const fillCount = [doc.purpose, doc.main_content, doc.detail_content, doc.decisions].filter(Boolean).length;
        const fill = Math.round((fillCount / 4) * 100);
        return `<div class="doc-card ${doc.is_completed?'doc-completed':''}">
          <div class="doc-card-top">
            <div class="doc-status-dot ${doc.is_completed?'dot-done':'dot-pending'}"></div>
            <h3 class="doc-card-title">${this.esc(doc.title)}</h3>
          </div>
          <div class="doc-card-meta">
            <span>${this.esc(doc.writer?.name||'작성자 미정')}</span>
            <span>${doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('ko-KR') : '-'}</span>
          </div>
          <div class="doc-fill-bar"><div class="doc-fill-progress" style="width:${fill}%"></div></div>
          <div class="doc-fill-label">작성 완성도 ${fill}%</div>
          <div class="doc-card-actions">
            <button class="btn-primary btn-sm" onclick="UI.openDocument('${doc.id}')">작성 / 수정</button>
            <button class="btn-sm btn-outline" onclick="Exporter.exportDocPDF('${doc.id}')">PDF</button>
            <button class="btn-sm btn-outline" onclick="Exporter.exportDocWord('${doc.id}')">Word</button>
          </div>
        </div>`;
      }).join('');
      container.innerHTML = `
<div class="page-header">
  <div class="page-title-en">Documents</div>
  <h1>산출물 작성</h1>
  <p class="page-subtitle">브랜딩 산출물을 웹에서 직접 작성하고 내보내세요. (${completed}/${docs.length} 완료)</p>
</div>
<div class="doc-export-bar">
  <button class="btn-primary" onclick="App.exportAllPDF()">📋 전체 PDF 내보내기</button>
  <button class="btn-outline" onclick="App.exportAllWord()">📝 전체 Word 내보내기</button>
  <button class="btn-outline" onclick="App.exportJSON()">💾 전체 JSON 백업</button>
</div>
<div class="doc-grid">${cards}</div>`;
    } catch(e) { container.innerHTML = `<div class="error-state">로드 실패: ${e.message}</div>`; }
  },

  // ════════════════════════════════════════════════════
  // 산출물 상세 모달
  // ════════════════════════════════════════════════════
  async openDocument(docId) {
    const modal = document.getElementById('modal-doc');
    const body = document.getElementById('modal-doc-body');
    body.innerHTML = '<div class="page-loading">불러오는 중...</div>';
    modal.classList.add('open'); document.body.classList.add('modal-open');
    try {
      const [doc, users, versions, comments] = await Promise.all([
        API.getDocument(docId),
        API.getUsers(),
        API.getDocumentVersions(docId),
        API.getComments('document', docId)
      ]);
      const canEdit = Auth.canEditDoc(doc);
      const writerOpts = users.map(u=>`<option value="${u.id}" ${doc.writer?.id===u.id?'selected':''}>${u.name}</option>`).join('');
      const reviewerOpts = users.map(u=>`<option value="${u.id}" ${doc.reviewer?.id===u.id?'selected':''}>${u.name}</option>`).join('');
      const versionRows = versions.slice(0,5).map(v => `
        <div class="version-item">
          <span class="version-num">v${v.version_number}</span>
          <span class="version-by">${v.editor?.name||'시스템'}</span>
          <span class="version-at">${this.fmtDateTime(v.edited_at)}</span>
          <span class="version-memo">${this.esc(v.change_memo||'')}</span>
          ${canEdit?`<button class="btn-sm btn-outline" onclick="UI.restoreVersion('${docId}','${v.id}')">복원</button>`:''}
        </div>`).join('') || '<div class="empty-state">버전 이력 없음</div>';
      const commentsHTML = this._buildComments(comments, 'document', docId);

      body.innerHTML = `
<div class="modal-doc-header">
  <div class="modal-doc-brand">금은미 브랜딩 프로젝트 · 2025년 6월</div>
  <h2 class="modal-doc-title">${this.esc(doc.title)}</h2>
  <div class="modal-doc-meta-row">
    <label>작성자
      <select class="meta-input" ${canEdit?'':'disabled'} onchange="UI.patchDoc('${docId}',{writer_id:this.value})">${writerOpts}</select>
    </label>
    <label>최종 검수자
      <select class="meta-input" ${Auth.canManageAll?'':'disabled'} onchange="UI.patchDoc('${docId}',{reviewer_id:this.value})">${reviewerOpts}</select>
    </label>
    <label class="checkbox-label">
      <input type="checkbox" id="doc-completed-${docId}" ${doc.is_completed?'checked':''} ${canEdit?'':'disabled'}
        onchange="UI.patchDoc('${docId}',{is_completed:this.checked})"> 완료 처리
    </label>
  </div>
  <div class="detail-meta-row">
    <span>최종 수정자: <strong>${this.esc(doc.updated_by_user?.name||'-')}</strong></span>
    <span>수정일: <strong>${this.fmtDateTime(doc.updated_at)}</strong></span>
  </div>
</div>
${this._docField('doc-purpose-'+docId,'목적',doc.purpose,'text',canEdit)}
${this._docField('doc-main-'+docId,'핵심 내용',doc.main_content,'textarea',canEdit)}
${this._docField('doc-detail-'+docId,'세부 항목',doc.detail_content,'textarea',canEdit)}
${this._docField('doc-decisions-'+docId,'결정된 사항',doc.decisions,'textarea',canEdit)}
${this._docField('doc-pending-'+docId,'보류된 사항',doc.pending_items,'textarea',canEdit)}
${this._docField('doc-check-'+docId,'추가 확인 필요',doc.check_required_items,'textarea',canEdit)}
${canEdit?`
<div class="modal-doc-actions">
  <input type="text" class="change-memo-input" id="change-memo-${docId}" placeholder="변경 메모 (선택)">
  <button class="btn-primary" onclick="UI.saveDocument('${docId}')">💾 저장</button>
  <button class="btn-outline" onclick="Exporter.exportDocPDF('${docId}')">PDF</button>
  <button class="btn-outline" onclick="Exporter.exportDocWord('${docId}')">Word</button>
  <button class="btn-outline" onclick="Exporter.exportDocHTML('${docId}')">HTML</button>
  <button class="btn-outline" onclick="Exporter.exportDocMarkdown('${docId}')">Markdown</button>
</div>`:`
<div class="modal-doc-actions">
  <button class="btn-outline" onclick="Exporter.exportDocPDF('${docId}')">PDF</button>
  <button class="btn-outline" onclick="Exporter.exportDocWord('${docId}')">Word</button>
</div>`}
<div class="version-section">
  <div class="section-title">버전 이력 (최근 5개)</div>
  ${versionRows}
</div>
<div class="comments-section">
  <div class="section-title">댓글 / 피드백</div>
  <div id="comments-document-${docId}">${commentsHTML}</div>
  ${Auth.canEdit?`<div class="comment-input-row">
    <input type="text" class="comment-input" id="comment-input-document-${docId}" placeholder="댓글을 입력하세요...">
    <button class="btn-primary btn-sm" onclick="UI.addComment('document','${docId}')">등록</button>
  </div>`:''}
</div>`;
    } catch(e) { body.innerHTML = `<div class="error-state">오류: ${e.message}</div>`; }
  },

  _docField(id, label, value, type, canEdit) {
    const disabled = canEdit ? '' : 'disabled readonly';
    if (type === 'textarea') {
      return `<div class="doc-field"><label class="doc-field-label">${label}</label>
        <textarea id="${id}" class="doc-textarea" ${disabled} placeholder="${label}을(를) 입력하세요...">${this.esc(value||'')}</textarea></div>`;
    }
    return `<div class="doc-field"><label class="doc-field-label">${label}</label>
      <input id="${id}" type="text" class="doc-input" ${disabled} placeholder="${label}을(를) 입력하세요..." value="${this.esc(value||'')}"></div>`;
  },

  async saveDocument(docId) {
    const fields = {
      purpose: document.getElementById('doc-purpose-'+docId)?.value || '',
      main_content: document.getElementById('doc-main-'+docId)?.value || '',
      detail_content: document.getElementById('doc-detail-'+docId)?.value || '',
      decisions: document.getElementById('doc-decisions-'+docId)?.value || '',
      pending_items: document.getElementById('doc-pending-'+docId)?.value || '',
      check_required_items: document.getElementById('doc-check-'+docId)?.value || '',
    };
    const memo = document.getElementById('change-memo-'+docId)?.value || '';
    try {
      await API.saveDocument(docId, fields, memo);
      this.toast('산출물이 저장되었습니다.');
      this.renderDocuments();
    } catch(e) { this.toast('저장 실패: ' + e.message, 'error'); }
  },

  async patchDoc(docId, fields) {
    try { await API.saveDocument(docId, fields); this.toast('저장됨'); }
    catch(e) { this.toast('저장 실패', 'error'); }
  },

  async restoreVersion(docId, versionId) {
    if (!confirm('이 버전으로 복원하시겠습니까?')) return;
    try {
      const versions = await API.getDocumentVersions(docId);
      const ver = versions.find(v => v.id === versionId);
      if (!ver) return;
      const snap = ver.content_snapshot;
      await API.saveDocument(docId, { purpose: snap.purpose, main_content: snap.main_content,
        detail_content: snap.detail_content, decisions: snap.decisions,
        pending_items: snap.pending_items, check_required_items: snap.check_required_items }, `v${ver.version_number} 버전 복원`);
      this.toast('버전이 복원되었습니다.');
      this.openDocument(docId);
    } catch(e) { this.toast('복원 실패', 'error'); }
  },

  closeDocModal() { document.getElementById('modal-doc').classList.remove('open'); document.body.classList.remove('modal-open'); },

  // ════════════════════════════════════════════════════
  // 댓글
  // ════════════════════════════════════════════════════
  _buildComments(comments, type, id) {
    if (!comments.length) return '<div class="empty-state">댓글이 없습니다.</div>';
    return comments.map(c => `
      <div class="comment-item" id="comment-${c.id}">
        <div class="comment-avatar">${(c.writer?.name||'?').charAt(0)}</div>
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-author">${this.esc(c.writer?.name||'알 수 없음')}</span>
            <span class="comment-time">${this.fmtDateTime(c.created_at)}</span>
            ${Auth.currentProfile?.id===c.writer_id||Auth.isAdmin?`<button class="comment-delete" onclick="UI.deleteComment('${c.id}','${type}','${id}')">삭제</button>`:''}
          </div>
          <div class="comment-text">${this.esc(c.content)}</div>
        </div>
      </div>`).join('');
  },

  async addComment(type, id) {
    const input = document.getElementById(`comment-input-${type}-${id}`);
    if (!input || !input.value.trim()) return;
    try {
      const comment = await API.addComment(type, id, input.value.trim());
      input.value = '';
      const container = document.getElementById(`comments-${type}-${id}`);
      if (container) {
        const newHTML = this._buildComments(
          (await API.getComments(type, id)), type, id
        );
        container.innerHTML = newHTML;
      }
    } catch(e) { this.toast('댓글 등록 실패: ' + e.message, 'error'); }
  },

  async deleteComment(commentId, type, targetId) {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await API.deleteComment(commentId);
      const container = document.getElementById(`comments-${type}-${targetId}`);
      if (container) {
        const newHTML = this._buildComments(await API.getComments(type, targetId), type, targetId);
        container.innerHTML = newHTML;
      }
    } catch(e) { this.toast('삭제 실패', 'error'); }
  },

  // ════════════════════════════════════════════════════
  // 관리자 — 사용자 관리
  // ════════════════════════════════════════════════════
  async renderAdmin() {
    if (!Auth.isAdmin) {
      document.getElementById('view-admin').innerHTML = '<div class="error-state">관리자 권한이 필요합니다.</div>';
      return;
    }
    const container = document.getElementById('view-admin');
    container.innerHTML = '<div class="page-loading">사용자 목록을 불러오는 중...</div>';
    try {
      const users = await API.getUsers();
      const rows = users.map(u => `
        <tr>
          <td>${this.esc(u.name)}</td>
          <td>${this.esc(u.email)}</td>
          <td>${this.esc(u.position||'-')}</td>
          <td>
            <select class="inline-select" onchange="UI.updateUserRole('${u.id}',this.value)">
              ${['admin','brand_manager','member','viewer'].map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${this._roleLabel(r)}</option>`).join('')}
            </select>
          </td>
          <td>${this.fmtDate(u.created_at)}</td>
        </tr>`).join('');
      container.innerHTML = `
<div class="page-header">
  <div class="page-title-en">Admin</div>
  <h1>사용자 관리</h1>
  <p class="page-subtitle">팀원 계정 및 권한을 관리합니다. (총 ${users.length}명)</p>
</div>
<div class="table-wrap">
  <table class="task-table">
    <thead><tr><th>이름</th><th>이메일</th><th>직책</th><th>권한</th><th>가입일</th></tr></thead>
    <tbody>${rows||'<tr><td colspan="5" class="empty-state">사용자가 없습니다.</td></tr>'}</tbody>
  </table>
</div>`;
    } catch(e) { container.innerHTML = `<div class="error-state">로드 실패: ${e.message}</div>`; }
  },

  async updateUserRole(userId, role) {
    try {
      await API.updateUser(userId, { role });
      this.toast('권한이 업데이트되었습니다.');
    } catch(e) { this.toast('업데이트 실패: ' + e.message, 'error'); }
  }
};
