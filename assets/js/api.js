// ════════════════════════════════════════════════════════
// api.js — Supabase CRUD API (v2.2 최적화)
// 변경: 쿼리 단순화, 타임아웃 처리, 에러 핸들링 강화
// ════════════════════════════════════════════════════════

const API = {

  // ── 쿼리 래퍼 (타임아웃 10초) ────────────────────────
  async _query(fn) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('요청 시간 초과 (10초). 새로고침 해주세요.')), 10000)
    );
    return Promise.race([fn(), timeout]);
  },

  // ════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════
  async getUsers() {
    const cached = Cache.get('users');
    if (cached) return cached;
    const { data, error } = await this._query(() =>
      db.from('users').select('id,name,email,role,position,created_at').order('created_at')
    );
    if (error) throw error;
    Cache.set('users', data);
    return data;
  },

  async updateUser(id, fields) {
    const { data, error } = await this._query(() =>
      db.from('users').update(fields).eq('id', id).select().single()
    );
    if (error) throw error;
    Cache.invalidate('users');
    return data;
  },

  // ════════════════════════════════════════════════════
  // TASKS — 조인 최소화
  // ════════════════════════════════════════════════════
  async getTasks() {
    const { data, error } = await this._query(() =>
      db.from('tasks')
        .select('*')
        .order('week')
        .order('start_date', { nullsFirst: true })
    );
    if (error) throw error;

    // users 캐시로 owner/writer 정보 보완
    const users = await this.getUsers();
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    return (data || []).map(t => ({
      ...t,
      owner: userMap[t.owner_id] || null,
      writer: userMap[t.writer_id] || null,
      updated_by_user: userMap[t.updated_by] || null,
    }));
  },

  async createTask(fields) {
    const uid = Auth.currentProfile?.id;
    const { data, error } = await this._query(() =>
      db.from('tasks')
        .insert({ ...fields, writer_id: uid, updated_by: uid })
        .select().single()
    );
    if (error) throw error;
    return data;
  },

  async updateTask(id, fields) {
    const uid = Auth.currentProfile?.id;
    const { data, error } = await this._query(() =>
      db.from('tasks')
        .update({ ...fields, updated_by: uid })
        .eq('id', id)
        .select().single()
    );
    if (error) throw error;
    return data;
  },

  async deleteTask(id) {
    const { error } = await this._query(() =>
      db.from('tasks').delete().eq('id', id)
    );
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════
  // TASK HISTORIES
  // ════════════════════════════════════════════════════
  async getTaskHistories(taskId) {
    const { data, error } = await this._query(() =>
      db.from('task_histories')
        .select('*')
        .eq('task_id', taskId)
        .order('changed_at', { ascending: false })
        .limit(20)
    );
    if (error) throw error;
    const users = await this.getUsers();
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });
    return (data || []).map(h => ({
      ...h,
      changed_by_user: userMap[h.changed_by] || null,
    }));
  },

  // ════════════════════════════════════════════════════
  // COLLABORATIONS
  // ════════════════════════════════════════════════════
  async getCollaborations() {
    const { data, error } = await this._query(() =>
      db.from('collaborations')
        .select('*')
        .order('created_at', { ascending: false })
    );
    if (error) throw error;
    const users = await this.getUsers();
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });
    // tasks 캐시
    const { data: tasks } = await db.from('tasks').select('id,title,week');
    const taskMap = {};
    (tasks || []).forEach(t => { taskMap[t.id] = t; });
    return (data || []).map(c => ({
      ...c,
      creator: userMap[c.created_by] || null,
      task: taskMap[c.task_id] || null,
    }));
  },

  async getCollaborationByTask(taskId) {
    const { data, error } = await this._query(() =>
      db.from('collaborations')
        .select('*')
        .eq('task_id', taskId)
        .maybeSingle()
    );
    if (error) throw error;
    return data;
  },

  async upsertCollaboration(taskId, fields) {
    const uid = Auth.currentProfile?.id;
    const existing = await this.getCollaborationByTask(taskId);
    if (existing) {
      const { data, error } = await this._query(() =>
        db.from('collaborations').update(fields).eq('id', existing.id).select().single()
      );
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this._query(() =>
        db.from('collaborations')
          .insert({ ...fields, task_id: taskId, created_by: uid })
          .select().single()
      );
      if (error) throw error;
      await this.updateTask(taskId, { collaboration_required: true });
      return data;
    }
  },

  // ════════════════════════════════════════════════════
  // DOCUMENTS — 조인 최소화
  // ════════════════════════════════════════════════════
  async getDocuments() {
    const { data, error } = await this._query(() =>
      db.from('documents').select('*').order('created_at')
    );
    if (error) throw error;
    const users = await this.getUsers();
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });
    return (data || []).map(d => ({
      ...d,
      writer: userMap[d.writer_id] || null,
      reviewer: userMap[d.reviewer_id] || null,
      updated_by_user: userMap[d.updated_by] || null,
    }));
  },

  async getDocument(id) {
    const { data, error } = await this._query(() =>
      db.from('documents').select('*').eq('id', id).single()
    );
    if (error) throw error;
    const users = await this.getUsers();
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });
    return {
      ...data,
      writer: userMap[data.writer_id] || null,
      reviewer: userMap[data.reviewer_id] || null,
      updated_by_user: userMap[data.updated_by] || null,
    };
  },

  async saveDocument(id, fields, changeMemo = '') {
    const uid = Auth.currentProfile?.id;
    const { data, error } = await this._query(() =>
      db.from('documents')
        .update({ ...fields, writer_id: fields.writer_id || uid, updated_by: uid })
        .eq('id', id)
        .select().single()
    );
    if (error) throw error;
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
    const { data, error } = await this._query(() =>
      db.from('document_versions')
        .select('*')
        .eq('document_id', docId)
        .order('version_number', { ascending: false })
        .limit(10)
    );
    if (error) throw error;
    const users = await this.getUsers();
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });
    return (data || []).map(v => ({
      ...v,
      editor: userMap[v.edited_by] || null,
    }));
  },

  // ════════════════════════════════════════════════════
  // COMMENTS
  // ════════════════════════════════════════════════════
  async getComments(targetType, targetId) {
    const { data, error } = await this._query(() =>
      db.from('comments')
        .select('*')
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .order('created_at')
    );
    if (error) throw error;
    const users = await this.getUsers();
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });
    return (data || []).map(c => ({
      ...c,
      writer: userMap[c.writer_id] || null,
    }));
  },

  async addComment(targetType, targetId, content) {
    const uid = Auth.currentProfile?.id;
    if (!uid) throw new Error('로그인이 필요합니다.');
    const { data, error } = await this._query(() =>
      db.from('comments')
        .insert({ target_type: targetType, target_id: targetId, content, writer_id: uid })
        .select('*').single()
    );
    if (error) throw error;
    const users = await this.getUsers();
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });
    return { ...data, writer: userMap[data.writer_id] || null };
  },

  async deleteComment(id) {
    const { error } = await this._query(() =>
      db.from('comments').delete().eq('id', id)
    );
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════
  // EXPORT LOGS
  // ════════════════════════════════════════════════════
  async logExport(exportType, scope = '') {
    const uid = Auth.currentProfile?.id;
    try {
      await db.from('export_logs').insert({
        export_type: exportType,
        exported_by: uid,
        export_scope: scope
      });
    } catch(e) {
      // 로그 실패는 무시
    }
  },

  // ════════════════════════════════════════════════════
  // STATS
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

    const byAssignee = {};
    tasks.forEach(t => {
      const name = t.owner?.name || '미배정';
      byAssignee[name] = (byAssignee[name] || 0) + 1;
    });

    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const thisWeekTasks = tasks.filter(t => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= monday && d <= sunday;
    });

    return { total, completed, inProgress, delayed, collabNeeded, docsCompleted, progress, byAssignee, thisWeekTasks };
  }
};

// ════════════════════════════════════════════════════════
// Realtime 구독
// ════════════════════════════════════════════════════════
const Realtime = {
  channels: {},

  subscribe(table, callback) {
    if (this.channels[table]) this.unsubscribe(table);
    const channel = db
      .channel(`rt-${table}-${Date.now()}`)
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
