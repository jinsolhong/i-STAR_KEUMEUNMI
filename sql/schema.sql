-- ════════════════════════════════════════════════════════
-- 금은미 브랜딩 프로젝트 — Supabase 스키마 SQL
-- 실행 순서: Supabase Dashboard > SQL Editor 에서 전체 실행
-- ════════════════════════════════════════════════════════

-- ── 확장 기능 활성화 ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════
-- 1. users 테이블 (Supabase Auth와 연동)
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin','brand_manager','member','viewer')),
  position    TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 자동 updated_at 트리거 함수 ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 신규 Auth 사용자 자동 users 행 생성 ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, position)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    COALESCE(NEW.raw_user_meta_data->>'position', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════
-- 2. tasks 테이블
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tasks (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                  TEXT NOT NULL,
  week                   INTEGER NOT NULL CHECK (week BETWEEN 1 AND 5),
  start_date             DATE,
  due_date               DATE,
  owner_id               UUID REFERENCES public.users(id) ON DELETE SET NULL,
  writer_id              UUID REFERENCES public.users(id) ON DELETE SET NULL,
  priority               TEXT NOT NULL DEFAULT '보통'
                           CHECK (priority IN ('높음','보통','낮음')),
  status                 TEXT NOT NULL DEFAULT '예정'
                           CHECK (status IN ('예정','진행 중','검토 필요','수정 중','완료','보류')),
  output_type            TEXT,
  collaboration_required BOOLEAN NOT NULL DEFAULT FALSE,
  memo                   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by             UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ════════════════════════════════════════════════════════
-- 3. task_histories 테이블 (수정 이력)
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.task_histories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  changed_field TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── tasks 변경 이력 자동 기록 트리거 ────────────────────
CREATE OR REPLACE FUNCTION public.record_task_history()
RETURNS TRIGGER AS $$
DECLARE
  col TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'title','week','start_date','due_date','owner_id','writer_id',
    'priority','status','output_type','collaboration_required','memo'
  ]
  LOOP
    EXECUTE format('SELECT ($1).%I::TEXT', col) INTO old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::TEXT', col) INTO new_val USING NEW;
    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO public.task_histories
        (task_id, changed_field, old_value, new_value, changed_by)
      VALUES
        (NEW.id, col, old_val, new_val, NEW.updated_by);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_task_updated
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.record_task_history();

-- ════════════════════════════════════════════════════════
-- 4. collaborations 테이블
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.collaborations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id             UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  request_department  TEXT,
  request_person      TEXT,
  request_content     TEXT,
  request_due_date    DATE,
  reference_link      TEXT,
  request_status      TEXT NOT NULL DEFAULT '요청 전'
                        CHECK (request_status IN ('요청 전','요청 완료','회신 대기','진행 중','완료','보류')),
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_collaborations_updated_at
  BEFORE UPDATE ON public.collaborations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ════════════════════════════════════════════════════════
-- 5. documents 테이블
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.documents (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                   TEXT NOT NULL,
  template_type           TEXT NOT NULL,
  writer_id               UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewer_id             UUID REFERENCES public.users(id) ON DELETE SET NULL,
  purpose                 TEXT,
  main_content            TEXT,
  detail_content          TEXT,
  decisions               TEXT,
  pending_items           TEXT,
  check_required_items    TEXT,
  related_task_id         UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  related_collaboration_id UUID REFERENCES public.collaborations(id) ON DELETE SET NULL,
  is_completed            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by              UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ════════════════════════════════════════════════════════
-- 6. document_versions 테이블
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.document_versions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id      UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number   INTEGER NOT NULL DEFAULT 1,
  content_snapshot JSONB NOT NULL,
  edited_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  edited_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_memo      TEXT,
  UNIQUE (document_id, version_number)
);

-- ── 문서 저장 시 자동 버전 생성 ──────────────────────────
CREATE OR REPLACE FUNCTION public.create_document_version()
RETURNS TRIGGER AS $$
DECLARE
  next_ver INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_ver
    FROM public.document_versions
   WHERE document_id = NEW.id;

  INSERT INTO public.document_versions
    (document_id, version_number, content_snapshot, edited_by, change_memo)
  VALUES (
    NEW.id,
    next_ver,
    jsonb_build_object(
      'title', NEW.title,
      'purpose', NEW.purpose,
      'main_content', NEW.main_content,
      'detail_content', NEW.detail_content,
      'decisions', NEW.decisions,
      'pending_items', NEW.pending_items,
      'check_required_items', NEW.check_required_items,
      'is_completed', NEW.is_completed
    ),
    NEW.updated_by,
    '자동 저장 버전'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_document_updated
  AFTER INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.create_document_version();

-- ════════════════════════════════════════════════════════
-- 7. comments 테이블
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL CHECK (target_type IN ('task','document','collaboration')),
  target_id   UUID NOT NULL,
  content     TEXT NOT NULL,
  writer_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ════════════════════════════════════════════════════════
-- 8. export_logs 테이블
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.export_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  export_type  TEXT NOT NULL,
  exported_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  exported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  export_scope TEXT
);

-- ════════════════════════════════════════════════════════
-- 9. Row Level Security (RLS) 설정
-- ════════════════════════════════════════════════════════

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_all" ON public.users FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "users_update_self" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_admin_all" ON public.users FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin'));

-- tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_all" ON public.tasks FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "tasks_insert_manager" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','brand_manager'));
CREATE POLICY "tasks_update_owner_or_manager" ON public.tasks FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR writer_id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','brand_manager')
  );
CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- task_histories
ALTER TABLE public.task_histories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "histories_select_all" ON public.task_histories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "histories_insert_auth" ON public.task_histories FOR INSERT TO authenticated WITH CHECK (TRUE);

-- collaborations
ALTER TABLE public.collaborations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collab_select_all" ON public.collaborations FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "collab_insert_member" ON public.collaborations FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','brand_manager','member'));
CREATE POLICY "collab_update_creator_or_manager" ON public.collaborations FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','brand_manager')
  );
CREATE POLICY "collab_delete_admin" ON public.collaborations FOR DELETE TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','brand_manager'));

-- documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select_all" ON public.documents FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "docs_insert_member" ON public.documents FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','brand_manager','member'));
CREATE POLICY "docs_update_writer_or_manager" ON public.documents FOR UPDATE TO authenticated
  USING (
    writer_id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','brand_manager')
  );
CREATE POLICY "docs_delete_admin" ON public.documents FOR DELETE TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- document_versions
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docver_select_all" ON public.document_versions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "docver_insert_auth" ON public.document_versions FOR INSERT TO authenticated WITH CHECK (TRUE);

-- comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "comments_insert_auth" ON public.comments FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE TO authenticated USING (writer_id = auth.uid());
CREATE POLICY "comments_delete_own_or_admin" ON public.comments FOR DELETE TO authenticated
  USING (writer_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- export_logs
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exportlogs_select_admin" ON public.export_logs FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','brand_manager'));
CREATE POLICY "exportlogs_insert_auth" ON public.export_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ════════════════════════════════════════════════════════
-- 10. Realtime 활성화
-- ════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaborations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_histories;

-- ════════════════════════════════════════════════════════
-- 11. 기본 데이터 삽입 (실행 전 Auth에서 사용자 먼저 생성 필요)
-- ════════════════════════════════════════════════════════
-- 아래 SQL은 Auth 사용자 생성 후 직접 실행하거나
-- handle_new_user 트리거로 자동 생성됩니다.
-- 역할 업데이트 예시:
-- UPDATE public.users SET role = 'brand_manager', position = '마케팅팀 과장' WHERE email = 'your@email.com';
-- UPDATE public.users SET role = 'member', position = '대리' WHERE email = 'kih@email.com';
-- UPDATE public.users SET role = 'member', position = '사원' WHERE email = 'hg@email.com';
