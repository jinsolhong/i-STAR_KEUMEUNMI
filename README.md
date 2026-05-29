# 금은미 브랜딩 프로젝트 v2
### GitHub Pages + Supabase 기반 팀 협업형 브랜딩 PM 웹앱

> 14K 골드 주얼리 브랜드 **금은미**의 2025년 6월 브랜딩 전략 수립을 위한  
> **로그인 · 실시간 협업 · 권한 관리 · 수정 이력 · 버전 관리** 기능을 갖춘 정적 웹앱

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 브랜드 | 금은미 (14K 골드 주얼리) |
| 타겟 고객 | 30대 여성 / 스몰럭셔리 |
| 프로젝트 기간 | 2025년 6월 (5주차) |
| 브랜딩 총괄 | 마케팅팀 과장 |
| 팀원 | 김인희 대리 · 한결 사원 |
| 핵심 메시지 | "하루의 끝, 나에게 닿는 빛" |
| 프론트엔드 | GitHub Pages (정적) |
| 백엔드/DB/인증 | Supabase |

---

## 파일 구조

```
/
├── index.html                    ← 단일 페이지 앱 진입점
├── README.md
├── assets/
│   ├── css/
│   │   └── style.css             ← 전체 스타일 (골드 브랜드 테마)
│   └── js/
│       ├── supabase.js           ← Supabase 클라이언트 · Auth · Cache
│       ├── api.js                ← Supabase CRUD API 전체 · Realtime
│       ├── export.js             ← PDF / Word / HTML / Markdown / JSON
│       ├── ui.js                 ← UI 렌더링 & 인터랙션 전체
│       └── app.js                ← 라우터 · 초기화 · Realtime 구독
├── sql/
│   ├── schema.sql                ← 테이블 · RLS · 트리거 · Realtime SQL
│   └── seed-data.sql             ← 기본 업무 · 산출물 데이터 SQL
└── docs/
    └── README.md                 ← 이 파일
```

---

## 주요 기능

| 메뉴 | 기능 |
|------|------|
| **로그인** | Supabase Auth 이메일/비밀번호 로그인, 비밀번호 초기화 |
| **대시보드** | 진행률, 이번 주 업무, 지연 업무, 담당자별 현황 |
| **6월 로드맵** | 5주차 탭, 인라인 상태 변경, 협업 요청 버튼 |
| **업무 관리** | 46개 업무 테이블, 필터, 담당자·상태 인라인 편집 |
| **산출물 작성** | 18개 브랜딩 문서, 버전 이력, 댓글, PDF/Word 내보내기 |
| **협업 요청** | 타부서 협업 현황, 상태 관리 |
| **사용자 관리** | 관리자 전용, 권한 변경 |
| **실시간 반영** | Supabase Realtime — 업무 상태·댓글·문서 변경 즉시 반영 |

---

## 1단계: Supabase 프로젝트 생성

1. [https://supabase.com](https://supabase.com) 접속 → **Start your project**
2. GitHub 계정으로 로그인 (권장)
3. **New Project** 클릭
4. 프로젝트 이름: `geumunmi-branding` (자유 설정)
5. 데이터베이스 비밀번호 설정 (안전한 값으로)
6. 리전: `Northeast Asia (Seoul)` 선택 권장
7. **Create new project** → 약 2분 대기

---

## 2단계: Supabase URL / API Key 연결

1. Supabase Dashboard → **Project Settings** → **API**
2. 아래 두 값을 복사:
   - **Project URL**: `https://xyzabcdef.supabase.co`
   - **anon public key**: `eyJhbGciOiJI...`
3. `assets/js/supabase.js` 파일 상단 수정:

```javascript
const SUPABASE_URL      = 'https://xyzabcdef.supabase.co';  // ← 교체
const SUPABASE_ANON_KEY = 'eyJhbGciOiJI...';                // ← 교체
```

---

## 3단계: Supabase 데이터베이스 테이블 생성

1. Supabase Dashboard → **SQL Editor**
2. **New Query** 클릭
3. `sql/schema.sql` 파일 내용 전체 복사 → 붙여넣기
4. **Run** (▶) 클릭
5. 성공 메시지 확인

> `schema.sql`에는 테이블 생성, 트리거, RLS 정책, Realtime 활성화가 모두 포함되어 있습니다.

---

## 4단계: 기본 데이터 삽입

1. SQL Editor → New Query
2. `sql/seed-data.sql` 내용 전체 복사 → 붙여넣기
3. **Run** 클릭

> 금은미 6월 브랜딩 로드맵 46개 업무와 18개 산출물 문서가 삽입됩니다.

---

## 5단계: Supabase Auth 설정

### 이메일 인증 설정
1. Dashboard → **Authentication** → **Providers**
2. **Email** 활성화 확인 (기본 활성화)
3. 개발 단계에서는 **Confirm email** 비활성화 권장:
   - Authentication → **Settings** → `Enable email confirmations` 끄기

### 기본 사용자 생성
1. Dashboard → **Authentication** → **Users** → **Add user**
2. 아래 3명 생성:

| 이름 | 이메일 | 비밀번호 | 역할 |
|------|--------|----------|------|
| 마케팅팀 과장 | manager@geumunmi.com | (설정) | brand_manager |
| 김인희 | kih@geumunmi.com | (설정) | member |
| 한결 | hg@geumunmi.com | (설정) | member |

### 사용자 권한 설정
사용자 생성 후 SQL Editor에서 역할 업데이트:

```sql
-- 브랜딩 총괄 권한 설정
UPDATE public.users
SET role = 'brand_manager', position = '마케팅팀 과장', name = '마케팅팀 과장'
WHERE email = 'manager@geumunmi.com';

-- 김인희 대리 권한 설정
UPDATE public.users
SET role = 'member', position = '대리', name = '김인희'
WHERE email = 'kih@geumunmi.com';

-- 한결 사원 권한 설정
UPDATE public.users
SET role = 'member', position = '사원', name = '한결'
WHERE email = 'hg@geumunmi.com';
```

---

## 6단계: GitHub Pages 배포

1. GitHub에서 새 저장소 생성 (예: `geumunmi-branding`)
2. 이 프로젝트 파일 전체 업로드:

```bash
git init
git add .
git commit -m "feat: 금은미 브랜딩 웹앱 초기 구축"
git remote add origin https://github.com/<username>/geumunmi-branding.git
git push -u origin main
```

3. GitHub 저장소 → **Settings** → **Pages**
4. **Source**: `Deploy from a branch`
5. **Branch**: `main` / **Folder**: `/ (root)`
6. **Save** → 약 1~2분 후 배포 완료
7. `https://<username>.github.io/geumunmi-branding/` 접속

### GitHub Pages에서 Supabase 연결 허용
Supabase Dashboard → **Authentication** → **URL Configuration**:
- **Site URL**: `https://<username>.github.io/geumunmi-branding`
- **Redirect URLs**: `https://<username>.github.io/geumunmi-branding`

---

## 7단계: Supabase Realtime 설정 확인

`schema.sql` 실행 시 자동 설정되지만, 수동 확인 방법:

1. Dashboard → **Database** → **Replication**
2. `tasks`, `collaborations`, `documents`, `comments`, `task_histories` 테이블이 `supabase_realtime` 퍼블리케이션에 포함되어 있는지 확인
3. 누락된 경우 SQL Editor에서 실행:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaborations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
```

---

## 로컬에서 실행하는 방법

```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve .

# VS Code: Live Server 확장 → index.html 우클릭 → Open with Live Server
```

브라우저에서 `http://localhost:8080` 접속  
로컬 실행 시에도 Supabase 연결은 동일하게 동작합니다.

---

## 사용자 권한 구조

| 권한 | 역할 값 | 가능한 작업 |
|------|---------|------------|
| **관리자** | `admin` | 전체 생성/수정/삭제, 사용자 관리, 모든 산출물 수정, 완료 처리 |
| **브랜딩 총괄** | `brand_manager` | 전체 로드맵 수정, 산출물 최종 승인, 협업 요청 생성, PDF/Word 내보내기 |
| **팀원** | `member` | 담당 업무 수정, 본인 작성 산출물 수정, 협업 요청 작성, 상태 변경 |
| **조회자** | `viewer` | 전체 조회, PDF/Word 내보내기 (수정 불가) |

---

## 데이터 저장 구조

### Supabase (메인 저장소)
모든 업무 데이터, 산출물, 협업 요청, 댓글, 수정 이력이 Supabase PostgreSQL에 저장됩니다.

```
Supabase DB
├── users           (팀원 정보 · 권한)
├── tasks           (업무 목록 · 상태)
├── task_histories  (업무 수정 이력 — 자동 트리거)
├── collaborations  (협업 요청)
├── documents       (산출물 18개)
├── document_versions (버전 이력 — 자동 트리거)
├── comments        (댓글 · 피드백)
└── export_logs     (내보내기 이력)
```

### localStorage (보조 캐시)
- 사용자 목록을 5분간 캐싱 (API 호출 최소화)
- 세션 토큰 자동 관리 (Supabase Auth 내장)
- 앱 종료 후 재접속 시 자동 로그인 유지

---

## 실시간 반영 항목

Supabase Realtime 구독으로 아래 항목은 **다른 팀원 화면에도 즉시 반영**됩니다:

- 업무 상태 변경 (예정 → 진행 중 → 완료)
- 담당자 / 작성자 변경
- 우선순위 / 마감일 변경
- 협업 요청 생성 · 상태 변경
- 산출물 문서 수정 (저장 시)
- 댓글 추가 · 삭제
- 완료 여부 변경

---

## PDF 내보내기

1. **단일 산출물**: 산출물 카드 → **PDF** 버튼
2. **전체 산출물**: 사이드바 → **전체 산출물 PDF** 또는 산출물 페이지 상단 버튼
3. **로드맵 PDF**: 사이드바 → **로드맵 PDF**
4. 브라우저 인쇄 창 → **PDF로 저장** (Chrome/Edge 권장)

> **인쇄 설정 권장**: 여백 최소, 배경 그래픽 포함

---

## Word 내보내기

1. 산출물 카드 → **Word** 버튼 또는 사이드바 → **전체 Word**
2. `.doc` 파일 자동 다운로드 (HTML→Word 변환 방식)
3. Microsoft Word / LibreOffice에서 열기
4. 저장 시 `.docx`로 변환 가능

---

## JSON 백업

1. 사이드바 → **JSON 백업** 또는 산출물 페이지 → **전체 JSON 백업**
2. `geumunmi_backup_YYYY-MM-DD.json` 자동 다운로드
3. 파일에 tasks, documents, collaborations 전체 포함

> JSON 백업은 데이터 보관 목적이며, 복원은 SQL Editor를 통해 수동으로 진행하거나 향후 복원 기능으로 확장 가능합니다.

---

## 수정 이력 보기

업무 상세 모달 → **수정 이력** 섹션에서 확인:
- 변경된 필드명
- 이전 값 → 변경된 값
- 수정자 이름
- 수정 시각

> 수정 이력은 PostgreSQL 트리거로 자동 기록되며, 삭제 불가능합니다.

---

## 버전 관리 보기

산출물 작성 모달 → **버전 이력** 섹션에서 확인:
- 버전 번호 (v1, v2, v3...)
- 작성자 이름
- 저장 시각
- 변경 메모
- **복원** 버튼 (권한 보유자)

> 문서 저장 시 자동으로 버전이 생성됩니다.

---

## 브라우저 호환성

| 브라우저 | 지원 |
|---------|------|
| Chrome 90+ | ✅ 권장 |
| Edge 90+ | ✅ 권장 |
| Firefox 88+ | ✅ |
| Safari 14+ | ✅ |
| IE 11 | ❌ 미지원 |

---

## 사용된 라이브러리

| 라이브러리 | 용도 | 방식 |
|-----------|------|------|
| `@supabase/supabase-js@2` | 인증 · DB · Realtime | CDN |
| Google Fonts (Cormorant Garamond, Noto Serif KR, Noto Sans KR) | 타이포그래피 | CSS @import |

> PDF는 브라우저 인쇄 기능, Word는 HTML→doc 변환 방식을 사용합니다.  
> 별도 JS 라이브러리 없이 순수 Vanilla JS로 구현되었습니다.

---

## GitHub Pages + Supabase 구조 설명

```
[팀원 브라우저]
    │  HTTPS 접속
    ▼
[GitHub Pages]          ← index.html, CSS, JS (정적 파일 호스팅)
    │  Supabase JS SDK
    ▼
[Supabase]
    ├── Auth            ← 로그인 · 세션 관리 · JWT 발급
    ├── Database        ← PostgreSQL (RLS 정책 적용)
    ├── Realtime        ← WebSocket 기반 실시간 변경 구독
    └── Storage         ← (파일 첨부 기능 확장 시 사용)
```

- **GitHub Pages**: 서버 없이 HTML/CSS/JS를 전 세계에 배포
- **Supabase**: 백엔드 역할 (DB + 인증 + 실시간)
- **RLS (Row Level Security)**: DB 레벨에서 권한 제어 → 안전한 직접 연결

---

## 보안 주의사항

- `SUPABASE_ANON_KEY`는 공개 키이며 클라이언트에서 사용 가능합니다
- 실제 데이터 접근 제어는 **RLS 정책**이 담당합니다
- `schema.sql`의 RLS 정책이 올바르게 적용되었는지 반드시 확인하세요
- 민감한 비즈니스 로직은 Supabase **Edge Functions**으로 분리 권장

---

## 향후 기능 확장 아이디어

- [ ] **파일 첨부**: Supabase Storage 연동 (무드보드 이미지 등)
- [ ] **알림**: 마감일 임박 이메일 알림 (Supabase Edge Functions)
- [ ] **Gantt 차트**: 6월 전체 일정 시각화
- [ ] **비밀번호 변경**: 프로필 설정 페이지
- [ ] **다크모드**: CSS 변수 기반 테마 전환
- [ ] **7월 확장**: 프로젝트 복사 및 새 월 시작 기능
- [ ] **Google SSO**: Supabase OAuth 연동
- [ ] **Slack 알림**: 업무 상태 변경 시 Slack Webhook 연동

---

*금은미 브랜딩 팀 · 2025년 6월*  
*"하루의 끝, 나에게 닿는 빛"*
