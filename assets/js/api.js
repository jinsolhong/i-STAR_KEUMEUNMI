// ════════════════════════════════════════════════════════
// api.js — Supabase CRUD 전체 API 모듈
// ════════════════════════════════════════════════════════

const API = {
  // ════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════
  async getUsers() {
    const cached = Cache.get('users');
    if (cached) return cached;
    const { data, error } = await db.from('users').select('*').order('created_at');
    if (error) throw error;
    Cache.set('users', data);
    return data;
  },

  async updateUser(id, fields) {
    const { data, error } = await db.from('users').update(fields).eq('id', id).select().single();
    if (error) throw error;
    Cache.invalidate('users');
    return data;
  },

  // ════════════════════════════════════════════════════
  // TASKS
  // ════════════════════════════════════════════════════
  async getTasks() {
    const { data, error } = await db
      .from('tasks')
      .select(`
        *,
        owner:owner_id(id,name,role,position),
        writer:writer_id(id,name,role,position),
        updated_by_user:updated_by(id,name)
      `)
      .order('week')
      .order('start_date');
    if (error) throw error;
    return data;
  },

  async createTask(fields) {
    const uid = Auth.currentProfile?.id;
    const { data, error } = await db
      .from('tasks')
      .insert({ ...fields, writer_id: uid, updated_by: uid })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTask(id, fields) {
    const uid = Auth.currentProfile?.id;
    const { data, error } = await db
      .from('tasks')
      .update({ ...fields, updated_by: uid })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTask(id) {
    const { error } = await db.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════
  // TASK HISTORIES
  // ════════════════════════════════════════════════════
  async getTaskHistories(taskId) {
    const { data, error } = await db
      .from('task_histories')
      .select('*, changed_by_user:changed_by(id,name)')
      .eq('task_id', taskId)
      .order('changed_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // ════════════════════════════════════════════════════
  // COLLABORATIONS
  // ════════════════════════════════════════════════════
  async getCollaborations() {
    const { data, error } = await db
      .from('collaborations')
      .select('*, task:task_id(id,title,week), creator:created_by(id,name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getCollaborationByTask(taskId) {
    const { data, error } = await db
      .from('collaborations')
      .select('*')
      .eq('task_id', taskId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertCollaboration(taskId, fields) {
    const uid = Auth.currentProfile?.id;
    const existing = await this.getCollaborationByTask(taskId);
    if (existing) {
      const { data, error } = await db
        .from('collaborations')
        .update(fields)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await db
        .from('collaborations')
        .insert({ ...fields, task_id: taskId, created_by: uid })
        .select()
        .single();
      if (error) throw error;
      // task에 collaboration_required = true 업데이트
      await this.updateTask(taskId, { collaboration_required: true });
      return data;
    }
  },

  // ════════════════════════════════════════════════════
  // DOCUMENTS
  // ════════════════════════════════════════════════════
  async getDocuments() {
    const { data, error } = await db
      .from('documents')
      .select(`
        *,
        writer:writer_id(id,name),
        reviewer:reviewer_id(id,name),
        updated_by_user:updated_by(id,name)
      `)
      .order('created_at');
    if (error) throw error;
    return data;
  },

  async getDocument(id) {
    const { data, error } = await db
      .from('documents')
      .select(`
        *,
        writer:writer_id(id,name),
        reviewer:reviewer_id(id,name),
        updated_by_user:updated_by(id,name)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async saveDocument(id, fields, changeMemo = '') {
    const uid = Auth.currentProfile?.id;
    const { data, error } = await db
      .from('documents')
      .update({ ...fields, writer_id: fields.writer_id || uid, updated_by: uid })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    // 수동 버전 메모가 있으면 마지막 버전의 change_memo 업데이트
    if (changeMemo) {
      const { data: latestVer } = await db
        .from('document_versions')
        .select('id')
        .eq('document_id', id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();
      if (latestVer) {
        await db.from('document_versions')
          .update({ change_memo: changeMemo })
          .eq('id', latestVer.id);
      }
    }
    return data;
  },

  // ════════════════════════════════════════════════════
  // DOCUMENT VERSIONS
  // ════════════════════════════════════════════════════
  async getDocumentVersions(docId) {
    const { data, error } = await db
      .from('document_versions')
      .select('*, editor:edited_by(id,name)')
      .eq('document_id', docId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    return data;
  },

  // ════════════════════════════════════════════════════
  // COMMENTS
  // ════════════════════════════════════════════════════
  async getComments(targetType, targetId) {
    const { data, error } = await db
      .from('comments')
      .select('*, writer:writer_id(id,name,role)')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at');
    if (error) throw error;
    return data;
  },

  async addComment(targetType, targetId, content) {
    const uid = Auth.currentProfile?.id;
    if (!uid) throw new Error('로그인이 필요합니다.');
    const { data, error } = await db
      .from('comments')
      .insert({ target_type: targetType, target_id: targetId, content, writer_id: uid })
      .select('*, writer:writer_id(id,name,role)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteComment(id) {
    const { error } = await db.from('comments').delete().eq('id', id);
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════
  // EXPORT LOGS
  // ════════════════════════════════════════════════════
  async logExport(exportType, scope = '') {
    const uid = Auth.currentProfile?.id;
    await db.from('export_logs').insert({
      export_type: exportType,
      exported_by: uid,
      export_scope: scope
    });
  },

  // ════════════════════════════════════════════════════
  // STATS (대시보드용 집계)
  // ════════════════════════════════════════════════════
  async getStats(tasks, documents) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === '완료').length;
    const inProgress = tasks.filter(t => t.status === '진행 중').length;
    const today = new Date(); today.setHours(0,0,0,0);
    const delayed = tasks.filter(t =>
      t.status !== '완료' && t.due_date && new Date(t.due_date) < today
    ).length;
    const collabNeeded = tasks.filter(t => t.collaboration_required).length;
    const docsCompleted = documents.filter(d => d.is_completed).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 담당자별 업무 수
    const byAssignee = {};
    tasks.forEach(t => {
      const name = t.owner?.name || '미배정';
      byAssignee[name] = (byAssignee[name] || 0) + 1;
    });

    // 이번 주 업무 (월~일)
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const thisWeekTasks = tasks.filter(t => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= monday && d <= sunday;
    });

    return { total, completed, inProgress, delayed, collabNeeded, docsCompleted, progress, byAssignee, thisWeekTasks };
  }
};

// ════════════════════════════════════════════════════════
// Realtime 구독 관리
// ════════════════════════════════════════════════════════
const Realtime = {
  channels: {},

  subscribe(table, callback) {
    if (this.channels[table]) this.unsubscribe(table);
    const channel = db
      .channel(`public-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
        callback(payload);
      })
      .subscribe();
    this.channels[table] = channel;
  },

  unsubscribe(table) {
    if (this.channels[table]) {
      db.removeChannel(this.channels[table]);
      delete this.channels[table];
    }
  },

  unsubscribeAll() {
    Object.keys(this.channels).forEach(t => this.unsubscribe(t));
  }
};
