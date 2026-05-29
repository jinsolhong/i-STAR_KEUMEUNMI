// ════════════════════════════════════════════════════════
// export.js — PDF / Word / HTML / Markdown / JSON 내보내기
// Supabase 최신 데이터 기준으로 내보냄
// ════════════════════════════════════════════════════════

const Exporter = {
  // ── 공통 유틸 ────────────────────────────────────────
  esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  today() { return new Date().toLocaleDateString('ko-KR'); },
  isoDate() { return new Date().toISOString().split('T')[0]; },

  // ── export 로그 기록 ──────────────────────────────────
  async log(type, scope) {
    try { await API.logExport(type, scope); } catch(e) {}
  },

  // ════════════════════════════════════════════════════
  // PDF (브라우저 인쇄 방식)
  // ════════════════════════════════════════════════════
  async exportDocPDF(docId) {
    UI.showLoading('PDF를 준비하는 중...');
    try {
      const doc = await API.getDocument(docId);
      const win = window.open('', '_blank');
      win.document.write(this._buildDocHTML(doc));
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); UI.hideLoading(); }, 600);
      await this.log('PDF', doc.title);
    } catch(e) { UI.hideLoading(); UI.toast('PDF 내보내기 실패: ' + e.message, 'error'); }
  },

  async exportAllPDF(tasks, documents) {
    UI.showLoading('전체 PDF를 준비하는 중...');
    try {
      const win = window.open('', '_blank');
      win.document.write(this._buildFullReportHTML(tasks, documents));
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); UI.hideLoading(); }, 600);
      await this.log('PDF_ALL', '전체 산출물');
    } catch(e) { UI.hideLoading(); UI.toast('PDF 내보내기 실패', 'error'); }
  },

  async exportRoadmapPDF(tasks) {
    UI.showLoading('로드맵 PDF 준비 중...');
    try {
      const win = window.open('', '_blank');
      win.document.write(this._buildRoadmapHTML(tasks));
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); UI.hideLoading(); }, 600);
      await this.log('PDF_ROADMAP', '6월 로드맵');
    } catch(e) { UI.hideLoading(); UI.toast('오류 발생', 'error'); }
  },

  // ════════════════════════════════════════════════════
  // Word (.doc HTML 방식)
  // ════════════════════════════════════════════════════
  async exportDocWord(docId) {
    UI.showLoading('Word 파일을 준비하는 중...');
    try {
      const doc = await API.getDocument(docId);
      const html = this._buildDocHTML(doc);
      this._downloadWord(html, `금은미_${doc.title}_${this.isoDate()}.doc`);
      UI.hideLoading();
      await this.log('Word', doc.title);
    } catch(e) { UI.hideLoading(); UI.toast('Word 내보내기 실패', 'error'); }
  },

  async exportAllWord(tasks, documents) {
    UI.showLoading('전체 Word 파일 준비 중...');
    try {
      const html = this._buildFullReportHTML(tasks, documents);
      this._downloadWord(html, `금은미_브랜딩_전체산출물_${this.isoDate()}.doc`);
      UI.hideLoading();
      await this.log('Word_ALL', '전체 산출물');
    } catch(e) { UI.hideLoading(); UI.toast('오류 발생', 'error'); }
  },

  _downloadWord(html, filename) {
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  // ════════════════════════════════════════════════════
  // HTML 내보내기
  // ════════════════════════════════════════════════════
  async exportDocHTML(docId) {
    try {
      const doc = await API.getDocument(docId);
      const html = this._buildDocHTML(doc);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `금은미_${doc.title}_${this.isoDate()}.html`; a.click();
      URL.revokeObjectURL(url);
      await this.log('HTML', doc.title);
    } catch(e) { UI.toast('HTML 내보내기 실패', 'error'); }
  },

  // ════════════════════════════════════════════════════
  // Markdown 내보내기
  // ════════════════════════════════════════════════════
  async exportDocMarkdown(docId) {
    try {
      const doc = await API.getDocument(docId);
      const md = this._buildMarkdown(doc);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `금은미_${doc.title}_${this.isoDate()}.md`; a.click();
      URL.revokeObjectURL(url);
      await this.log('Markdown', doc.title);
    } catch(e) { UI.toast('Markdown 내보내기 실패', 'error'); }
  },

  // ════════════════════════════════════════════════════
  // JSON 전체 백업
  // ════════════════════════════════════════════════════
  async exportJSON(tasks, documents, collaborations) {
    UI.showLoading('JSON 백업 준비 중...');
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        project: '금은미 브랜딩 프로젝트 2025년 6월',
        version: '2.0',
        exportedBy: Auth.currentProfile?.name,
        data: { tasks, documents, collaborations }
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `geumunmi_backup_${this.isoDate()}.json`; a.click();
      URL.revokeObjectURL(url);
      UI.hideLoading();
      await this.log('JSON_BACKUP', '전체 데이터');
    } catch(e) { UI.hideLoading(); UI.toast('JSON 백업 실패', 'error'); }
  },

  // ════════════════════════════════════════════════════
  // HTML 빌더 — 단일 문서
  // ════════════════════════════════════════════════════
  _buildDocHTML(doc) {
    const fields = [
      { label: '목적', value: doc.purpose },
      { label: '핵심 내용', value: doc.main_content },
      { label: '세부 항목', value: doc.detail_content },
      { label: '결정된 사항', value: doc.decisions },
      { label: '보류된 사항', value: doc.pending_items },
      { label: '추가 확인 필요', value: doc.check_required_items },
    ].filter(f => f.value);
    const rows = fields.map(f => `
      <tr>
        <th style="width:150px;background:#f9f5ef;color:#5a3e28;padding:10px 14px;font-weight:600;border:1px solid #e8dcc8;vertical-align:top;">${f.label}</th>
        <td style="padding:10px 14px;border:1px solid #e8dcc8;white-space:pre-wrap;line-height:1.8;">${this.esc(f.value)}</td>
      </tr>`).join('');
    const writerName = doc.writer?.name || doc.writer_id || '-';
    const reviewerName = doc.reviewer?.name || '-';
    const updatedBy = doc.updated_by_user?.name || '-';
    return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>${this.esc(doc.title)} — 금은미 브랜딩</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Noto+Sans+KR:wght@400;500&display=swap');
*{box-sizing:border-box}body{font-family:'Noto Sans KR',sans-serif;font-size:13px;color:#2c2220;background:#fff;margin:0;padding:0}
.cover{padding:60px 80px 40px;border-bottom:2px solid #c9a96e}.brand-label{font-size:10px;letter-spacing:0.3em;color:#c9a96e;margin-bottom:8px}
.doc-title{font-family:'Noto Serif KR',serif;font-size:28px;font-weight:600;color:#2c2220;margin:0 0 16px}
.meta{font-size:12px;color:#8a7060;display:flex;gap:24px;flex-wrap:wrap}.content{padding:40px 80px}
table{width:100%;border-collapse:collapse}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cover{padding:40px}.content{padding:20px 40px}}
</style></head><body>
<div class="cover">
  <div class="brand-label">금은미 브랜딩 프로젝트 · 2025년 6월</div>
  <div class="doc-title">${this.esc(doc.title)}</div>
  <div class="meta">
    <span>작성자: ${this.esc(writerName)}</span>
    <span>최종 수정자: ${this.esc(updatedBy)}</span>
    <span>최종 수정일: ${doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('ko-KR') : '-'}</span>
    <span>검수자: ${this.esc(reviewerName)}</span>
    <span>완료: ${doc.is_completed ? '✅ 완료' : '🔄 작성 중'}</span>
  </div>
</div>
<div class="content"><table>${rows || '<tr><td style="padding:20px;color:#aaa;">작성된 내용이 없습니다.</td></tr>'}</table></div>
</body></html>`;
  },

  // ════════════════════════════════════════════════════
  // HTML 빌더 — 전체 보고서
  // ════════════════════════════════════════════════════
  _buildFullReportHTML(tasks, documents) {
    const WEEKS = [
      { n:1, title:'브랜드 진단 & 방향성 정리', period:'6월 2일~6일' },
      { n:2, title:'브랜드 전략 & 메시지 확정', period:'6월 9일~13일' },
      { n:3, title:'비주얼 브랜딩 & 상품 표현 구조 정리', period:'6월 16일~20일' },
      { n:4, title:'채널별 실행 전략 정리', period:'6월 23일~27일' },
      { n:5, title:'최종 정리 & 7월 실행 준비', period:'6월 30일' },
    ];
    const weekSections = WEEKS.map(w => {
      const wTasks = tasks.filter(t => t.week === w.n);
      const rows = wTasks.map(t => `<tr>
        <td style="padding:6px 10px;border:1px solid #e8dcc8;">${this.esc(t.title)}</td>
        <td style="padding:6px 10px;border:1px solid #e8dcc8;">${this.esc(t.owner?.name||'-')}</td>
        <td style="padding:6px 10px;border:1px solid #e8dcc8;">${t.status}</td>
        <td style="padding:6px 10px;border:1px solid #e8dcc8;">${t.due_date||'-'}</td>
      </tr>`).join('');
      return `<div style="margin-bottom:28px;">
  <h3 style="font-family:'Noto Serif KR',serif;color:#5a3e28;font-size:16px;">W${w.n} ${w.title}</h3>
  <p style="font-size:11px;color:#888;margin:2px 0 8px">${w.period}</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#f9f5ef;"><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">업무명</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">담당자</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">상태</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">마감일</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
    }).join('');
    const docSections = documents.map(doc => {
      const fields = [
        { label:'목적', value: doc.purpose },
        { label:'핵심 내용', value: doc.main_content },
        { label:'세부 항목', value: doc.detail_content },
        { label:'결정된 사항', value: doc.decisions },
        { label:'보류된 사항', value: doc.pending_items },
        { label:'추가 확인 필요', value: doc.check_required_items },
      ].filter(f => f.value);
      const rows = fields.map(f => `<tr><th style="width:130px;background:#f9f5ef;padding:8px 12px;border:1px solid #e8dcc8;font-weight:600;color:#5a3e28;vertical-align:top;">${f.label}</th><td style="padding:8px 12px;border:1px solid #e8dcc8;white-space:pre-wrap;">${this.esc(f.value)}</td></tr>`).join('');
      return `<div style="page-break-before:always;padding:40px;">
  <h2 style="font-family:'Noto Serif KR',serif;color:#2c2220;border-bottom:1px solid #c9a96e;padding-bottom:8px;">${this.esc(doc.title)}</h2>
  <p style="font-size:11px;color:#888;margin-bottom:12px;">작성자: ${this.esc(doc.writer?.name||'-')} | 수정일: ${doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('ko-KR') : '-'}</p>
  <table style="width:100%;border-collapse:collapse;">${rows||'<tr><td style="padding:12px;color:#aaa;">내용 없음</td></tr>'}</table>
</div>`;
    }).join('');
    return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>금은미 브랜딩 전체 보고서 — 2025년 6월</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Noto+Sans+KR:wght@400;500&display=swap');
*{box-sizing:border-box}body{font-family:'Noto Sans KR',sans-serif;font-size:13px;color:#2c2220;background:#fff;margin:0}
.cover-page{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:#faf8f4;page-break-after:always;padding:80px}
.roadmap-section{padding:40px;page-break-after:always}
h1{font-family:'Noto Serif KR',serif;color:#2c2220}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="cover-page">
  <div style="font-size:11px;letter-spacing:0.4em;color:#c9a96e;text-transform:uppercase;margin-bottom:16px;">Geumunmi · 14K Gold Jewelry</div>
  <h1 style="font-size:36px;">금은미 브랜딩 프로젝트</h1>
  <p style="font-size:15px;color:#8a7060;margin:12px 0 32px;">2025년 6월 브랜딩 전략 수립 보고서</p>
  <div style="width:60px;height:1px;background:#c9a96e;margin:0 auto 24px;"></div>
  <p style="font-size:13px;color:#8a7060;">브랜딩 총괄: 마케팅팀 과장<br>핵심 메시지: 하루의 끝, 나에게 닿는 빛<br>출력일: ${this.today()}</p>
</div>
<div class="roadmap-section"><h1>6월 전체 로드맵</h1>${weekSections}</div>
${docSections}
</body></html>`;
  },

  // ════════════════════════════════════════════════════
  // HTML 빌더 — 로드맵 전용
  // ════════════════════════════════════════════════════
  _buildRoadmapHTML(tasks) {
    const WEEKS = [
      { n:1, title:'브랜드 진단 & 방향성 정리', period:'6월 2~6일',   goal:'기존 브랜드 현황 파악 및 경쟁 분석을 통해 방향성 도출' },
      { n:2, title:'브랜드 전략 & 메시지 확정', period:'6월 9~13일',  goal:'브랜드 정체성·슬로건·소개문 확정' },
      { n:3, title:'비주얼 브랜딩 & 상품 표현 구조 정리', period:'6월 16~20일', goal:'무드보드·촬영 가이드·상세페이지 구조 정립' },
      { n:4, title:'채널별 실행 전략 정리', period:'6월 23~27일', goal:'자사몰·인스타·카카오·Meta 실행 전략 구체화' },
      { n:5, title:'최종 정리 & 7월 실행 준비', period:'6월 30일',   goal:'전체 문서 통합 및 7월 실행 준비 완료' },
    ];
    const sections = WEEKS.map(w => {
      const wTasks = tasks.filter(t => t.week === w.n);
      const rows = wTasks.map(t => `<tr>
        <td>${this.esc(t.title)}</td><td>${t.start_date||'-'}</td><td>${t.due_date||'-'}</td>
        <td>${this.esc(t.owner?.name||'-')}</td><td>${t.priority}</td><td>${t.status}</td>
        <td>${this.esc(t.output_type||'-')}</td><td>${t.collaboration_required?'✓':'-'}</td>
      </tr>`).join('');
      return `<div style="margin-bottom:36px;">
  <h2 style="font-family:'Noto Serif KR',serif;color:#5a3e28;">${w.title}</h2>
  <p style="font-size:11px;color:#888;margin:2px 0 4px;">${w.period}</p>
  <p style="font-size:12px;color:#5a3e28;padding:10px 14px;background:#f9f5ef;border-left:3px solid #c9a96e;margin-bottom:10px;">${w.goal}</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#f9f5ef;"><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">업무명</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">시작일</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">마감일</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">담당자</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">우선순위</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">상태</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">산출물</th><th style="padding:7px 10px;border:1px solid #e8dcc8;text-align:left;">협업</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
    }).join('');
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>금은미 6월 로드맵</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Noto+Sans+KR:wght@400;500&display=swap');
body{font-family:'Noto Sans KR',sans-serif;font-size:13px;color:#2c2220;padding:40px}
h1{font-family:'Noto Serif KR',serif;font-size:24px;color:#2c2220;border-bottom:2px solid #c9a96e;padding-bottom:12px;margin-bottom:24px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>금은미 브랜딩 프로젝트 — 6월 로드맵</h1>
<p style="color:#8a7060;margin-bottom:28px;">핵심 메시지: "하루의 끝, 나에게 닿는 빛" | 출력일: ${this.today()}</p>
${sections}
</body></html>`;
  },

  // ════════════════════════════════════════════════════
  // Markdown 빌더
  // ════════════════════════════════════════════════════
  _buildMarkdown(doc) {
    const lines = [
      `# ${doc.title}`,
      ``,
      `> 금은미 브랜딩 프로젝트 | 2025년 6월`,
      ``,
      `| 항목 | 내용 |`,
      `|------|------|`,
      `| 작성자 | ${doc.writer?.name||'-'} |`,
      `| 최종 수정자 | ${doc.updated_by_user?.name||'-'} |`,
      `| 최종 수정일 | ${doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('ko-KR') : '-'} |`,
      `| 검수자 | ${doc.reviewer?.name||'-'} |`,
      `| 완료 여부 | ${doc.is_completed ? '✅ 완료' : '🔄 작성 중'} |`,
      ``,
    ];
    [
      ['목적', doc.purpose],
      ['핵심 내용', doc.main_content],
      ['세부 항목', doc.detail_content],
      ['결정된 사항', doc.decisions],
      ['보류된 사항', doc.pending_items],
      ['추가 확인 필요', doc.check_required_items],
    ].forEach(([label, value]) => {
      if (value) lines.push(`## ${label}`, ``, value, ``);
    });
    return lines.join('\n');
  }
};
