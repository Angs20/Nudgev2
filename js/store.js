const Store = {
  KEY: 'nudge_app_v1',
  USERS_KEY: 'nudge_users',
  RESET_KEY: 'nudge_reset_tokens',

  defaultCategories() {
    return [
      { id: 'cat_work', name: 'Work', color: '#4A90D9' },
      { id: 'cat_study', name: 'Study', color: '#3FA76A' },
      { id: 'cat_personal', name: 'Personal', color: '#E8833A' },
    ];
  },

  defaultFilters() {
    return { category: '', priority: '', status: '' };
  },

  defaultState() {
    return {
      user: null,
      settings: {
        theme: 'system',
        weekStart: 1,
        nudgesEnabled: true,
        onboardingComplete: false,
        sortBy: 'manual',
        filters: this.defaultFilters(),
      },
      categories: this.defaultCategories(),
      tags: [],
      tasks: [],
      activity: [],
      _lastCreate: null,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaultState();
      const parsed = JSON.parse(raw);
      const state = { ...this.defaultState(), ...parsed };
      state.settings = { ...this.defaultState().settings, ...parsed.settings };
      state.settings.filters = { ...this.defaultFilters(), ...state.settings.filters };
      return state;
    } catch {
      return this.defaultState();
    }
  },

  save(state) {
    localStorage.setItem(this.KEY, JSON.stringify(state));
  },

  uid() {
    return crypto.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  },

  getState() {
    if (!this._state) this._state = this.load();
    return this._state;
  },

  setState(updater) {
    const state = this.getState();
    updater(state);
    this.save(state);
    return state;
  },

  reset() {
    localStorage.removeItem(this.KEY);
    this._state = this.defaultState();
    return this._state;
  },

  importData(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') throw new Error('Invalid backup file.');
    const merged = {
      ...this.defaultState(),
      ...data,
      settings: { ...this.defaultState().settings, ...data.settings },
    };
    merged.settings.filters = { ...this.defaultFilters(), ...merged.settings.filters };
    this._state = merged;
    this.save(merged);
    return merged;
  },

  // Auth
  signUp(email, password, name) {
    if (!Utils.validateEmail(email)) throw new Error('Please enter a valid email address.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const users = JSON.parse(localStorage.getItem(this.USERS_KEY) || '{}');
    if (users[email]) throw new Error('An account with this email already exists.');
    users[email] = { email, password, name, createdAt: new Date().toISOString() };
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    return this.login(email, password);
  },

  login(email, password) {
    if (!Utils.validateEmail(email)) throw new Error('Please enter a valid email address.');
    const users = JSON.parse(localStorage.getItem(this.USERS_KEY) || '{}');
    const u = users[email];
    if (!u || u.password !== password) throw new Error('Invalid email or password.');
    return this.setState(s => {
      s.user = { email: u.email, name: u.name };
    });
  },

  loginGoogle() {
    return this.setState(s => {
      s.user = { email: 'user@gmail.com', name: 'Aisha', provider: 'google' };
    });
  },

  logout() {
    return this.setState(s => { s.user = null; });
  },

  requestPasswordReset(email) {
    if (!Utils.validateEmail(email)) throw new Error('Please enter a valid email address.');
    const users = JSON.parse(localStorage.getItem(this.USERS_KEY) || '{}');
    if (!users[email]) throw new Error('No account found with that email.');
    const token = this.uid();
    const tokens = JSON.parse(localStorage.getItem(this.RESET_KEY) || '{}');
    tokens[token] = { email, expires: Date.now() + 3600000 };
    localStorage.setItem(this.RESET_KEY, JSON.stringify(tokens));
    return token;
  },

  resetPassword(token, newPassword) {
    if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
    const tokens = JSON.parse(localStorage.getItem(this.RESET_KEY) || '{}');
    const entry = tokens[token];
    if (!entry || entry.expires < Date.now()) throw new Error('Reset link has expired. Please request a new one.');
    const users = JSON.parse(localStorage.getItem(this.USERS_KEY) || '{}');
    if (!users[entry.email]) throw new Error('Account not found.');
    users[entry.email].password = newPassword;
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    delete tokens[token];
    localStorage.setItem(this.RESET_KEY, JSON.stringify(tokens));
    return this.login(entry.email, newPassword);
  },

  completeOnboarding() {
    return this.setState(s => { s.settings.onboardingComplete = true; });
  },

  updateSettings(partial) {
    return this.setState(s => { Object.assign(s.settings, partial); });
  },

  updateFilters(partial) {
    return this.setState(s => {
      Object.assign(s.settings.filters, partial);
    });
  },

  clearFilters() {
    return this.updateFilters(this.defaultFilters());
  },

  // Categories
  addCategory(name, color) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) throw new Error('Category name must be 1–40 characters.');
    const exists = this.getState().categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) throw new Error('A category with that name already exists.');
    const id = this.uid();
    this.setState(s => { s.categories.push({ id, name: trimmed, color }); });
    return id;
  },

  updateCategory(id, data) {
    return this.setState(s => {
      const cat = s.categories.find(c => c.id === id);
      if (cat) Object.assign(cat, data);
    });
  },

  deleteCategory(id) {
    return this.setState(s => {
      s.categories = s.categories.filter(c => c.id !== id);
      s.tasks.forEach(t => { if (t.categoryId === id) t.categoryId = null; });
    });
  },

  getCategory(id) {
    return this.getState().categories.find(c => c.id === id);
  },

  ensureTag(name) {
    const state = this.getState();
    let tag = state.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      tag = { id: this.uid(), name };
      this.setState(s => { s.tags.push(tag); });
    }
    return tag.id;
  },

  // Tasks
  createTask(data) {
    const title = (data.title || '').trim();
    if (!title) throw new Error('Title is required.');
    if (title.length > 500) throw new Error('Title must be 500 characters or fewer.');

    const state = this.getState();
    const dueDate = data.dueDate || null;
    if (state._lastCreate) {
      const { title: lt, dueDate: ld, at } = state._lastCreate;
      if (lt === title && ld === dueDate && Date.now() - at < 5000) {
        return { task: null, duplicate: true };
      }
    }

    const id = this.uid();
    const task = {
      id,
      title,
      dueDate,
      dueTime: data.dueTime || null,
      priority: data.priority || 'none',
      categoryId: data.categoryId || null,
      tagIds: data.tagIds || [],
      notes: data.notes || '',
      parentId: data.parentId || null,
      status: 'active',
      completedAt: null,
      position: data.position ?? Date.now(),
      recurrence: data.recurrence || null,
      recurrenceDays: data.recurrenceDays || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.setState(s => {
      s.tasks.push(task);
      s._lastCreate = { title, dueDate, at: Date.now() };
    });
    this.logActivity('created', id);
    return { task, duplicate: false };
  },

  updateTask(id, data) {
    return this.setState(s => {
      const task = s.tasks.find(t => t.id === id);
      if (!task || task.status === 'deleted') return;
      Object.assign(task, data, { updatedAt: new Date().toISOString() });
    });
  },

  deleteTask(id, hard = false) {
    const task = this.getTask(id);
    if (!task) return null;
    const snapshot = JSON.parse(JSON.stringify(task));
    const subSnapshots = this.getSubtasks(id).map(s => JSON.parse(JSON.stringify(s)));

    if (hard) {
      this.setState(s => {
        s.tasks = s.tasks.filter(t => t.id !== id && t.parentId !== id);
      });
    } else {
      this.setState(s => {
        task.status = 'deleted';
        task.updatedAt = new Date().toISOString();
        s.tasks.filter(t => t.parentId === id).forEach(st => {
          st.status = 'deleted';
          st.updatedAt = new Date().toISOString();
        });
      });
    }
    this.logActivity('deleted', id);
    return { task: snapshot, subtasks: subSnapshots };
  },

  restoreTask(id) {
    return this.setState(s => {
      const task = s.tasks.find(t => t.id === id);
      if (task) {
        task.status = 'active';
        task.updatedAt = new Date().toISOString();
      }
    });
  },

  restoreDeleted(snapshot) {
    if (!snapshot) return;
    this.setState(s => {
      const exists = s.tasks.find(t => t.id === snapshot.id);
      if (exists) {
        Object.assign(exists, snapshot, { status: 'active', updatedAt: new Date().toISOString() });
      } else {
        s.tasks.push({ ...snapshot, status: 'active', updatedAt: new Date().toISOString() });
      }
    });
  },

  completeTask(id, completeSubtasks = false) {
    const task = this.getTask(id);
    if (!task || task.status !== 'active') return null;

    if (completeSubtasks && !task.parentId) {
      [...this.getSubtasks(id)].forEach(st => {
        if (st.status === 'active') this.completeTask(st.id, false);
      });
    }

    this.setState(s => {
      const t = s.tasks.find(x => x.id === id);
      if (!t || t.status !== 'active') return;
      t.status = 'completed';
      t.completedAt = new Date().toISOString();
      t.updatedAt = t.completedAt;
    });
    this.logActivity('completed', id);

    if (task.recurrence && !task.parentId) {
      return this.spawnNextOccurrence(task);
    }
    return null;
  },

  uncompleteTask(id) {
    return this.setState(s => {
      const task = s.tasks.find(t => t.id === id);
      if (task) {
        task.status = 'active';
        task.completedAt = null;
        task.updatedAt = new Date().toISOString();
      }
    });
  },

  reorderTasks(orderedIds) {
    return this.setState(s => {
      orderedIds.forEach((id, i) => {
        const task = s.tasks.find(t => t.id === id);
        if (task) task.position = i;
      });
    });
  },

  getTask(id) {
    return this.getState().tasks.find(t => t.id === id && t.status !== 'deleted');
  },

  getSubtasks(parentId) {
    return this.getState().tasks.filter(t => t.parentId === parentId && t.status !== 'deleted');
  },

  getTopLevelTasks() {
    return this.getState().tasks.filter(t => !t.parentId && t.status !== 'deleted');
  },

  carryForward(id, toDate) {
    return this.updateTask(id, { dueDate: toDate || Utils.todayStr() });
  },

  spawnNextOccurrence(task) {
    const nextDate = Utils.nextRecurrenceDate(task.dueDate, task.recurrence);
    if (!nextDate) return null;
    const result = this.createTask({
      title: task.title,
      dueDate: nextDate,
      dueTime: task.dueTime,
      priority: task.priority,
      categoryId: task.categoryId,
      tagIds: [...task.tagIds],
      notes: task.notes,
      recurrence: task.recurrence,
      recurrenceDays: [...task.recurrenceDays],
    });
    return result.task;
  },

  logActivity(type, taskId) {
    this.setState(s => {
      s.activity.push({
        id: this.uid(),
        type,
        taskId,
        date: Utils.todayStr(),
        timestamp: new Date().toISOString(),
      });
    });
  },

  getCompletionsForDate(dateStr) {
    return this.getState().activity.filter(a => a.type === 'completed' && a.date === dateStr).length;
  },

  getStreak() {
    const state = this.getState();
    const dates = new Set(
      state.activity.filter(a => a.type === 'completed').map(a => a.date)
    );
    let streak = 0;
    let d = new Date();
    const today = Utils.todayStr();
    if (!dates.has(today)) d.setDate(d.getDate() - 1);
    while (true) {
      const ds = Utils.dateToStr(d);
      if (dates.has(ds)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return streak;
  },

  getWeeklyCompletions() {
    const days = [];
    const d = new Date();
    for (let i = 6; i >= 0; i--) {
      const day = new Date(d);
      day.setDate(day.getDate() - i);
      const ds = Utils.dateToStr(day);
      days.push({
        date: ds,
        label: day.toLocaleDateString('en', { weekday: 'short' }),
        count: this.getCompletionsForDate(ds),
      });
    }
    return days;
  },

  getCategoryBreakdown() {
    const state = this.getState();
    const weekAgo = Utils.dateToStr(new Date(Date.now() - 6 * 86400000));
    const counts = {};
    state.categories.forEach(c => { counts[c.id] = { name: c.name, color: c.color, count: 0 }; });
    counts._none = { name: 'Uncategorized', color: '#C4CDD5', count: 0 };

    state.activity
      .filter(a => a.type === 'completed' && a.date >= weekAgo)
      .forEach(a => {
        const task = state.tasks.find(t => t.id === a.taskId);
        const catId = task?.categoryId;
        if (catId && counts[catId]) counts[catId].count++;
        else counts._none.count++;
      });

    return Object.values(counts).filter(c => c.count > 0);
  },

  searchTasks(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const state = this.getState();
    return state.tasks.filter(t => {
      if (t.status === 'deleted' || t.parentId) return false;
      const cat = state.categories.find(c => c.id === t.categoryId);
      const tagNames = t.tagIds.map(tid => state.tags.find(tg => tg.id === tid)?.name).filter(Boolean);
      return t.title.toLowerCase().includes(q)
        || (t.notes && t.notes.toLowerCase().includes(q))
        || (cat && cat.name.toLowerCase().includes(q))
        || tagNames.some(n => n.toLowerCase().includes(q));
    });
  },

  seedDemo() {
    const today = Utils.todayStr();
    const yesterday = Utils.dateToStr(new Date(Date.now() - 86400000));
    const tomorrow = Utils.dateToStr(new Date(Date.now() + 86400000));
    const cats = this.getState().categories;

    this.createTask({ title: 'Finish slides', dueDate: today, dueTime: '09:00', priority: 'high', categoryId: cats[0]?.id });
    this.createTask({ title: 'Buy groceries', dueDate: today, priority: 'low', categoryId: cats[2]?.id });
    this.createTask({ title: 'Read chapter 4', dueDate: today, categoryId: cats[1]?.id });
    this.createTask({ title: 'Email professor', dueDate: yesterday, priority: 'medium', categoryId: cats[1]?.id });
    this.createTask({ title: 'Lab report', dueDate: yesterday, categoryId: cats[1]?.id });
    this.createTask({ title: 'Call client', dueDate: tomorrow, categoryId: cats[0]?.id });
    const standup = this.createTask({ title: 'Weekly standup', dueDate: today, dueTime: '10:00', categoryId: cats[0]?.id });
    if (standup.task) this.completeTask(standup.task.id);
  },
};
