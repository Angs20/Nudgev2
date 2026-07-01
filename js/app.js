const App = {
  weekOffset: 0,
  onboardingStep: 0,
  pendingCompleteId: null,
  pendingDeleteSubs: false,
  dragTaskId: null,

  onboardingSlides: [
    { title: 'Today-first planning', text: 'Open Nudge and see only what matters today — not an overwhelming backlog.', mood: 'calm' },
    { title: 'Gentle nudges, not nags', text: 'Nima cheers your small wins. No guilt, no red badges — just calm encouragement.', mood: 'happy' },
    { title: 'Calm by design', text: 'A beautiful, minimal space to capture tasks in seconds and finish what counts.', mood: 'celebrate' },
  ],

  init() {
    this.applyTheme();
    this.bindGlobal();
    this.checkResetToken();

    if (Store.getState().user) {
      if (!Store.getState().settings.onboardingComplete) {
        this.showView('onboarding');
        this.renderOnboarding();
      } else {
        this.showView('today');
      }
    } else {
      this.showView('welcome');
    }
    this.render();
  },

  checkResetToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset');
    if (token) {
      this.resetToken = token;
      this.showView('reset');
      window.history.replaceState({}, '', window.location.pathname);
    }
  },

  bindGlobal() {
    document.getElementById('auth-form')?.addEventListener('submit', e => this.handleAuth(e));
    document.getElementById('auth-switch')?.addEventListener('click', () => this.toggleAuthMode());
    document.getElementById('btn-google')?.addEventListener('click', () => this.handleGoogleAuth());
    document.getElementById('btn-forgot')?.addEventListener('click', () => this.showView('forgot'));
    document.getElementById('forgot-form')?.addEventListener('submit', e => this.handleForgot(e));
    document.getElementById('btn-forgot-back')?.addEventListener('click', () => this.showView('welcome'));
    document.getElementById('reset-form')?.addEventListener('submit', e => this.handleReset(e));
    document.getElementById('btn-onboarding-next')?.addEventListener('click', () => this.nextOnboarding());
    document.getElementById('btn-onboarding-skip')?.addEventListener('click', () => this.finishOnboarding());
    document.getElementById('composer-form')?.addEventListener('submit', e => this.handleCreateTask(e));
    document.getElementById('composer-input')?.addEventListener('keydown', e => {
      if (e.key === 'n' && e.ctrlKey) { e.preventDefault(); document.getElementById('composer-input').focus(); }
    });
    document.getElementById('auth-password')?.addEventListener('input', e => this.updatePasswordStrength(e.target.value));
    document.getElementById('btn-search')?.addEventListener('click', () => this.openSearch());
    document.getElementById('search-input')?.addEventListener('input', Utils.debounce(e => this.renderSearchResults(e.target.value), 200));
    document.getElementById('overlay')?.addEventListener('click', () => this.closeSheets());
    document.getElementById('week-prev')?.addEventListener('click', () => { this.weekOffset--; this.renderPlanner(); });
    document.getElementById('week-next')?.addEventListener('click', () => { this.weekOffset++; this.renderPlanner(); });
    document.getElementById('btn-logout')?.addEventListener('click', () => this.handleLogout());
    document.getElementById('toggle-nudges')?.addEventListener('click', e => this.toggleNudges(e.target));
    document.getElementById('toggle-week-start')?.addEventListener('click', e => this.toggleWeekStart(e.target));
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportData());
    document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file')?.addEventListener('change', e => this.importData(e));
    document.getElementById('btn-clear-data')?.addEventListener('click', () => this.confirmClearData());
    document.getElementById('detail-save')?.addEventListener('click', () => this.saveTaskDetail());
    document.getElementById('detail-delete')?.addEventListener('click', () => this.deleteCurrentTask());
    document.getElementById('btn-add-subtask')?.addEventListener('click', () => this.addSubtaskField());
    document.getElementById('btn-add-category')?.addEventListener('click', () => this.promptAddCategory());
    document.getElementById('sort-select')?.addEventListener('change', e => {
      Store.updateSettings({ sortBy: e.target.value });
      this.renderToday();
    });
    const clearFilters = () => { Store.clearFilters(); this.renderToday(); };
    document.getElementById('btn-clear-filters')?.addEventListener('click', clearFilters);
    document.getElementById('btn-clear-filters-empty')?.addEventListener('click', clearFilters);

    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
    });

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.showView(btn.dataset.view));
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeSheets();
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (Store.getState().settings.theme === 'system') this.applyTheme();
    });
  },

  applyTheme() {
    const theme = Store.getState().settings.theme;
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.theme === theme);
    });
  },

  setTheme(theme) {
    Store.updateSettings({ theme });
    this.applyTheme();
  },

  showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${name}`)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
    const showNav = ['today', 'planner', 'stats', 'profile'].includes(name);
    document.getElementById('bottom-nav')?.classList.toggle('hidden', !showNav);
    if (name === 'today') this.renderToday();
    if (name === 'planner') this.renderPlanner();
    if (name === 'stats') this.renderStats();
    if (name === 'profile') this.renderProfile();
    if (name === 'welcome') this.clearAuthError();
  },

  render() {
    if (Store.getState().user) this.renderToday();
  },

  // Auth
  authMode: 'signin',

  clearAuthError() {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  },

  showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  },

  toggleAuthMode() {
    this.authMode = this.authMode === 'signin' ? 'signup' : 'signin';
    this.clearAuthError();
    document.getElementById('auth-title').textContent = this.authMode === 'signin' ? 'Welcome back' : 'Create account';
    document.getElementById('auth-submit').textContent = this.authMode === 'signin' ? 'Sign in' : 'Sign up';
    document.getElementById('name-group').classList.toggle('hidden', this.authMode === 'signin');
    document.getElementById('password-strength').classList.toggle('hidden', this.authMode === 'signin');
    document.getElementById('forgot-row').classList.toggle('hidden', this.authMode === 'signup');
    document.getElementById('auth-switch-text').innerHTML = this.authMode === 'signin'
      ? 'No account? <button type="button" id="auth-switch">Sign up</button>'
      : 'Have an account? <button type="button" id="auth-switch">Sign in</button>';
    document.getElementById('auth-switch')?.addEventListener('click', () => this.toggleAuthMode());
  },

  updatePasswordStrength(password) {
    const el = document.getElementById('password-strength');
    if (!el || this.authMode === 'signin') return;
    const s = Utils.passwordStrength(password);
    el.classList.remove('hidden');
    el.querySelector('.strength-bar-fill').style.width = s.width;
    el.querySelector('.strength-bar-fill').className = `strength-bar-fill ${s.class}`;
    el.querySelector('.strength-label').textContent = password ? s.label : '';
  },

  handleAuth(e) {
    e.preventDefault();
    this.clearAuthError();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name')?.value.trim() || email.split('@')[0];
    try {
      if (this.authMode === 'signup') {
        Store.signUp(email, password, name);
        Store.seedDemo();
      } else {
        Store.login(email, password);
      }
      this.afterAuth();
    } catch (err) {
      this.showAuthError(err.message);
    }
  },

  handleGoogleAuth() {
    Store.loginGoogle();
    if (Store.getState().tasks.length === 0) Store.seedDemo();
    this.afterAuth();
  },

  afterAuth() {
    if (!Store.getState().settings.onboardingComplete) {
      this.showView('onboarding');
      this.renderOnboarding();
    } else {
      this.showView('today');
    }
  },

  handleForgot(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const errEl = document.getElementById('forgot-error');
    const okEl = document.getElementById('forgot-success');
    try {
      const token = Store.requestPasswordReset(email);
      errEl.classList.add('hidden');
      okEl.classList.remove('hidden');
      okEl.innerHTML = `Reset link generated (demo): <a href="?reset=${token}">Click here to reset</a>`;
    } catch (err) {
      okEl.classList.add('hidden');
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  },

  handleReset(e) {
    e.preventDefault();
    const password = document.getElementById('reset-password').value;
    const errEl = document.getElementById('reset-error');
    try {
      Store.resetPassword(this.resetToken, password);
      errEl.classList.add('hidden');
      this.toast('Password updated — welcome back!');
      this.afterAuth();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  },

  renderOnboarding() {
    const slide = this.onboardingSlides[this.onboardingStep];
    document.getElementById('onboarding-mascot').innerHTML = mascotSvg(100, slide.mood);
    document.getElementById('onboarding-title').textContent = slide.title;
    document.getElementById('onboarding-text').textContent = slide.text;
    document.querySelectorAll('.onboarding-dots span').forEach((d, i) => d.classList.toggle('active', i === this.onboardingStep));
    document.getElementById('btn-onboarding-next').textContent = this.onboardingStep === this.onboardingSlides.length - 1 ? 'Get started' : 'Next';
  },

  nextOnboarding() {
    if (this.onboardingStep < this.onboardingSlides.length - 1) {
      this.onboardingStep++;
      this.renderOnboarding();
    } else {
      this.finishOnboarding();
    }
  },

  finishOnboarding() {
    Store.completeOnboarding();
    this.showView('today');
  },

  handleLogout() {
    Store.logout();
    this.showView('welcome');
  },

  // Today view
  renderToday() {
    const state = Store.getState();
    const user = state.user;
    document.getElementById('header-date').textContent = Utils.formatHeaderDate();
    document.getElementById('header-greeting').textContent = Utils.greeting(user?.name);
    document.getElementById('streak-count').textContent = Store.getStreak();

    const sortBy = state.settings.sortBy;
    const filters = state.settings.filters;
    document.getElementById('sort-select').value = sortBy;

    const tasks = Store.getTopLevelTasks();
    const today = Utils.todayStr();

    let overdue = tasks.filter(t => t.status === 'active' && Utils.isOverdue(t));
    let todayTasks = tasks.filter(t => t.status === 'active' && (t.dueDate === today || !t.dueDate));
    let completed = tasks.filter(t => t.status === 'completed' && t.completedAt?.slice(0, 10) === today);

    if (Utils.hasActiveFilters(filters)) {
      overdue = Utils.filterTasks(overdue, filters);
      todayTasks = Utils.filterTasks(todayTasks, filters);
      completed = Utils.filterTasks(completed, filters);
    }

    overdue = Utils.sortTasks(overdue, sortBy);
    todayTasks = Utils.sortTasks(todayTasks, sortBy);
    completed = Utils.sortTasks(completed, sortBy === 'manual' ? 'created' : sortBy);

    this.renderFilterBar();
    this.renderTaskList('carry-list', overdue, { carryForward: true, sortable: sortBy === 'manual' });
    this.renderTaskList('today-list', todayTasks, { sortable: sortBy === 'manual' });
    this.renderTaskList('completed-list', completed, { completed: true });

    document.getElementById('carry-section').classList.toggle('hidden', overdue.length === 0);
    document.getElementById('carry-count').textContent = overdue.length;

    const hasFilters = Utils.hasActiveFilters(filters);
    const totalVisible = overdue.length + todayTasks.length + completed.length;
    const allDone = todayTasks.length === 0 && overdue.length === 0 && completed.length > 0 && !hasFilters;
    const empty = todayTasks.length === 0 && overdue.length === 0 && completed.length === 0 && !hasFilters;
    const filterEmpty = hasFilters && totalVisible === 0;

    document.getElementById('empty-today').classList.toggle('hidden', !empty);
    document.getElementById('all-done').classList.toggle('hidden', !allDone);
    document.getElementById('filter-empty').classList.toggle('hidden', !filterEmpty);

    if (empty) document.getElementById('empty-mascot').innerHTML = mascotSvg(100, 'calm');
    if (allDone && state.settings.nudgesEnabled) {
      document.getElementById('alldone-mascot').innerHTML = mascotSvg(80, 'celebrate');
    }
  },

  renderFilterBar() {
    const state = Store.getState();
    const filters = state.settings.filters;
    const el = document.getElementById('filter-chips');
    if (!el) return;

    const categories = state.categories;
    el.innerHTML = `
      <button type="button" class="chip filter-chip ${filters.category === '' ? 'selected' : ''}" data-filter="category" data-value="">All categories</button>
      ${categories.map(c => `<button type="button" class="chip filter-chip ${filters.category === c.id ? 'selected' : ''}" data-filter="category" data-value="${c.id}">${Utils.escapeHtml(c.name)}</button>`).join('')}
      <span class="filter-divider"></span>
      ${['', 'high', 'medium', 'low'].map(p => `<button type="button" class="chip filter-chip ${filters.priority === p ? 'selected' : ''}" data-filter="priority" data-value="${p}">${p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All priorities'}</button>`).join('')}
    `;

    el.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.filter;
        const val = chip.dataset.value;
        Store.updateFilters({ [key]: filters[key] === val ? '' : val });
        this.renderToday();
      });
    });

    document.getElementById('btn-clear-filters').classList.toggle('hidden', !Utils.hasActiveFilters(filters));
  },

  renderTaskList(containerId, tasks, opts = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = tasks.map(t => this.taskRowHtml(t, opts)).join('');
    this.bindTaskRowEvents(el, opts);
    if (opts.sortable) this.bindSortableList(el);
  },

  bindTaskRowEvents(el, opts = {}) {
    el.querySelectorAll('.task-checkbox').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.toggleComplete(btn.dataset.id); });
    });
    el.querySelectorAll('.carry-action').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.carryTask(btn.dataset.id); });
    });
    el.querySelectorAll('.task-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.drag-handle')) return;
        this.openTaskDetail(row.dataset.id);
      });
    });
  },

  taskRowHtml(task, opts = {}) {
    const cat = Store.getCategory(task.categoryId);
    const subtasks = Store.getSubtasks(task.id);
    const doneSubs = subtasks.filter(s => s.status === 'completed').length;
    const checked = task.status === 'completed';
    const meta = [];
    if (task.dueTime) meta.push(`<span class="task-time">${Utils.formatTime(task.dueTime)}</span>`);
    if (cat) meta.push(`<span class="category-chip" style="background:${cat.color}22;color:${cat.color}">${Utils.escapeHtml(cat.name)}</span>`);
    if (subtasks.length) meta.push(`<span class="subtask-progress">${doneSubs}/${subtasks.length}</span>`);

    const dragHandle = opts.sortable && !opts.completed
      ? `<span class="drag-handle" draggable="true" data-id="${task.id}" aria-label="Drag to reorder">${Icons.grip}</span>`
      : '';

    return `<div class="task-row ${checked ? 'completed' : ''}" data-id="${task.id}" draggable="${opts.planner ? 'true' : 'false'}">
      ${dragHandle}
      <button class="task-checkbox ${checked ? 'checked' : ''}" data-id="${task.id}" aria-label="${checked ? 'Mark incomplete' : 'Mark complete'}">${Icons.check}</button>
      <div class="task-body">
        <div class="task-title">${Utils.escapeHtml(task.title)}</div>
        ${meta.length ? `<div class="task-meta">${meta.join('')}</div>` : ''}
      </div>
      ${task.priority !== 'none' ? `<span class="priority-dot" style="background:${Utils.priorityColor(task.priority)}" title="${task.priority} priority"></span>` : ''}
      ${opts.carryForward ? `<button class="carry-action" data-id="${task.id}">→ today</button>` : ''}
    </div>`;
  },

  bindSortableList(listEl) {
    listEl.querySelectorAll('.drag-handle').forEach(handle => {
      handle.addEventListener('dragstart', e => {
        this.dragTaskId = handle.dataset.id;
        e.dataTransfer.effectAllowed = 'move';
        handle.closest('.task-row')?.classList.add('dragging');
      });
      handle.addEventListener('dragend', () => {
        listEl.querySelectorAll('.task-row').forEach(r => r.classList.remove('dragging', 'drag-over'));
        this.dragTaskId = null;
      });
    });

    listEl.querySelectorAll('.task-row').forEach(row => {
      row.addEventListener('dragover', e => {
        if (!this.dragTaskId) return;
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (!this.dragTaskId || this.dragTaskId === row.dataset.id) return;
        const ids = [...listEl.querySelectorAll('.task-row')].map(r => r.dataset.id);
        const fromIdx = ids.indexOf(this.dragTaskId);
        const toIdx = ids.indexOf(row.dataset.id);
        if (fromIdx < 0 || toIdx < 0) return;
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, this.dragTaskId);
        Store.reorderTasks(ids);
        this.renderToday();
      });
    });
  },

  handleCreateTask(e) {
    e.preventDefault();
    const input = document.getElementById('composer-input');
    const title = input.value.trim();
    if (!title) return;
    const result = Store.createTask({ title, dueDate: Utils.todayStr() });
    if (result.duplicate) {
      this.toast('Looks like you just added that task');
      return;
    }
    input.value = '';
    input.focus();
    this.renderToday();
    this.toast('Task added');
  },

  toggleComplete(id) {
    const task = Store.getTask(id);
    if (!task) return;

    if (task.status === 'completed') {
      Store.uncompleteTask(id);
      this.toast('Task restored');
    } else {
      const subs = Store.getSubtasks(id);
      const openSubs = subs.filter(s => s.status === 'active');
      if (openSubs.length > 0 && !task.parentId) {
        this.pendingCompleteId = id;
        document.getElementById('dialog-complete-subs').classList.add('open');
        document.getElementById('overlay').classList.add('open');
        return;
      }
      this.doComplete(id, false);
    }
    this.refreshViews();
  },

  doComplete(id, completeSubs) {
    const prev = { ...Store.getTask(id) };
    Store.completeTask(id, completeSubs);
    this.toast('Nice — that\'s done', 'Undo', () => {
      Store.uncompleteTask(id);
      Store.updateTask(id, { dueDate: prev.dueDate, completedAt: null, status: 'active' });
      this.refreshViews();
    });
    this.refreshViews();
    const todayActive = Store.getTopLevelTasks().filter(t => t.status === 'active' && (t.dueDate === Utils.todayStr() || !t.dueDate));
    if (todayActive.length === 0 && Store.getState().settings.nudgesEnabled) {
      setTimeout(() => this.renderToday(), 300);
    }
  },

  refreshViews() {
    this.renderToday();
    if (document.getElementById('view-planner').classList.contains('active')) this.renderPlanner();
    if (document.getElementById('view-stats').classList.contains('active')) this.renderStats();
  },

  carryTask(id) {
    Store.carryForward(id, Utils.todayStr());
    this.toast('Carried forward to today');
    this.renderToday();
  },

  // Planner
  renderPlanner() {
    const { days, rangeLabel } = Utils.getWeekRange(this.weekOffset);
    document.getElementById('week-range').textContent = rangeLabel;
    const tasks = Store.getTopLevelTasks().filter(t => t.status === 'active');
    const unscheduled = tasks.filter(t => !t.dueDate);

    document.getElementById('week-grid').innerHTML = days.map(day => {
      const dayTasks = tasks.filter(t => t.dueDate === day.date);
      return `<div class="week-day" data-date="${day.date}">
        <div class="week-day-header ${day.isToday ? 'today' : ''}"><span>${day.label} ${day.dayNum}</span><span>${dayTasks.length}</span></div>
        <div class="week-day-tasks drop-zone" data-date="${day.date}">${dayTasks.length ? dayTasks.map(t => this.taskRowHtml(t, { planner: true })).join('') : `<div class="week-day-empty">Drop tasks here</div>`}</div>
      </div>`;
    }).join('');

    document.getElementById('unscheduled-list').innerHTML = unscheduled.length
      ? unscheduled.map(t => `<span class="chip tag-chip planner-chip" draggable="true" data-id="${t.id}">${Utils.escapeHtml(t.title)}</span>`).join('')
      : '<span style="color:var(--color-text-muted);font-size:14px">No unscheduled tasks</span>';

    this.bindPlannerDragDrop();
    document.getElementById('week-grid').querySelectorAll('.task-checkbox').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.toggleComplete(btn.dataset.id); });
    });
    document.getElementById('week-grid').querySelectorAll('.task-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.drag-handle')) return;
        this.openTaskDetail(row.dataset.id);
      });
    });
  },

  bindPlannerDragDrop() {
    const onDragStart = e => {
      const id = e.target.dataset.id || e.target.closest('[data-id]')?.dataset.id;
      if (!id) return;
      this.dragTaskId = id;
      e.dataTransfer.effectAllowed = 'move';
      e.target.classList.add('dragging');
    };

    const onDragEnd = e => {
      e.target.classList.remove('dragging');
      document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
      this.dragTaskId = null;
    };

    document.querySelectorAll('.task-row[draggable="true"], .planner-chip').forEach(el => {
      el.addEventListener('dragstart', onDragStart);
      el.addEventListener('dragend', onDragEnd);
    });

    document.querySelectorAll('.drop-zone').forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', e => {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (!this.dragTaskId) return;
        Store.updateTask(this.dragTaskId, { dueDate: zone.dataset.date });
        this.toast(`Moved to ${Utils.formatDate(zone.dataset.date)}`);
        this.renderPlanner();
        this.renderToday();
      });
    });
  },

  // Stats
  renderStats() {
    const streak = Store.getStreak();
    const week = Store.getWeeklyCompletions();
    const totalCompleted = Store.getState().activity.filter(a => a.type === 'completed').length;
    const todayCount = Store.getCompletionsForDate(Utils.todayStr());
    const maxCount = Math.max(...week.map(d => d.count), 1);
    const breakdown = Store.getCategoryBreakdown();
    const maxCat = Math.max(...breakdown.map(c => c.count), 1);

    document.getElementById('stat-streak').textContent = streak;
    document.getElementById('stat-today').textContent = todayCount;
    document.getElementById('stat-week').textContent = week.reduce((s, d) => s + d.count, 0);
    document.getElementById('stat-total').textContent = totalCompleted;

    document.getElementById('activity-chart').innerHTML = week.map(d => `
      <div class="activity-day">
        <div class="activity-bar-fill ${d.count ? 'has-data' : ''}" style="height:${Math.max(4, (d.count / maxCount) * 64)}px" title="${d.count} completed"></div>
        <span class="activity-day-label">${d.label}</span>
      </div>`).join('');

    const catEl = document.getElementById('category-breakdown');
    if (breakdown.length === 0) {
      catEl.innerHTML = '<p style="color:var(--color-text-muted);font-size:14px;padding:8px 0">Complete tasks to see category insights.</p>';
    } else {
      catEl.innerHTML = breakdown.map(c => `
        <div class="category-stat-row">
          <span class="category-stat-dot" style="background:${c.color}"></span>
          <span class="category-stat-name">${Utils.escapeHtml(c.name)}</span>
          <div class="category-stat-bar"><div class="category-stat-fill" style="width:${(c.count / maxCat) * 100}%;background:${c.color}"></div></div>
          <span class="category-stat-count">${c.count}</span>
        </div>`).join('');
    }
  },

  // Profile
  renderProfile() {
    const user = Store.getState().user;
    if (!user) return;
    document.getElementById('profile-avatar').textContent = (user.name || user.email)[0].toUpperCase();
    document.getElementById('profile-name').textContent = user.name || 'User';
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('toggle-nudges').classList.toggle('on', Store.getState().settings.nudgesEnabled);
    document.getElementById('toggle-week-start').classList.toggle('on', Store.getState().settings.weekStart === 0);
    this.applyTheme();
    this.renderCategories();
  },

  renderCategories() {
    const el = document.getElementById('categories-list');
    el.innerHTML = Store.getState().categories.map(c => `
      <div class="category-row" data-id="${c.id}">
        <span class="category-color" style="background:${c.color}"></span>
        <input type="text" value="${Utils.escapeHtml(c.name)}" data-id="${c.id}" />
        <button class="btn-icon btn-delete-cat" data-id="${c.id}" aria-label="Delete">${Icons.trash}</button>
      </div>`).join('');
    el.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => Store.updateCategory(inp.dataset.id, { name: inp.value.trim() }));
    });
    el.querySelectorAll('.btn-delete-cat').forEach(btn => {
      btn.addEventListener('click', () => { Store.deleteCategory(btn.dataset.id); this.renderCategories(); });
    });
  },

  promptAddCategory() {
    const name = prompt('Category name:');
    if (!name?.trim()) return;
    try {
      const colors = ['#4A90D9', '#3FA76A', '#E8833A', '#9B59B6', '#E74C3C'];
      Store.addCategory(name.trim(), colors[Store.getState().categories.length % colors.length]);
      this.renderCategories();
    } catch (err) {
      this.toast(err.message);
    }
  },

  toggleNudges(btn) {
    const on = !btn.classList.contains('on');
    btn.classList.toggle('on', on);
    Store.updateSettings({ nudgesEnabled: on });
  },

  toggleWeekStart(btn) {
    const monday = btn.classList.contains('on');
    btn.classList.toggle('on', !monday);
    Store.updateSettings({ weekStart: monday ? 1 : 0 });
    this.renderPlanner();
  },

  exportData() {
    const data = JSON.stringify(Store.getState(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nudge-export.json';
    a.click();
    this.toast('Data exported');
  },

  importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importData(reader.result);
        this.toast('Data imported successfully');
        this.refreshViews();
        this.renderProfile();
      } catch (err) {
        this.toast(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },

  confirmClearData() {
    document.getElementById('dialog-clear').classList.add('open');
    document.getElementById('overlay').classList.add('open');
  },

  clearData() {
    Store.reset();
    this.closeSheets();
    this.showView('welcome');
  },

  // Task detail
  currentTaskId: null,

  openTaskDetail(id) {
    this.currentTaskId = id;
    const task = Store.getTask(id);
    if (!task) return;
    const state = Store.getState();

    document.getElementById('detail-title').value = task.title;
    document.getElementById('detail-date').value = task.dueDate || '';
    document.getElementById('detail-time').value = task.dueTime || '';
    document.getElementById('detail-notes').value = task.notes || '';

    document.getElementById('priority-chips').innerHTML = ['none', 'low', 'medium', 'high'].map(p =>
      `<button type="button" class="chip priority-${p} ${task.priority === p ? 'selected' : ''}" data-priority="${p}">${p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1)}</button>`
    ).join('');

    document.getElementById('category-chips').innerHTML = `<button type="button" class="chip ${!task.categoryId ? 'selected' : ''}" data-cat="">None</button>` +
      state.categories.map(c =>
        `<button type="button" class="chip ${task.categoryId === c.id ? 'selected' : ''}" data-cat="${c.id}"><span class="category-color" style="background:${c.color};width:10px;height:10px;display:inline-block;border-radius:50%"></span> ${Utils.escapeHtml(c.name)}</button>`
      ).join('');

    document.getElementById('recurrence-chips').innerHTML = ['', 'daily', 'weekdays', 'weekly', 'monthly'].map(r =>
      `<button type="button" class="chip ${(task.recurrence || '') === r ? 'selected' : ''}" data-recurrence="${r}">${r ? Utils.recurrenceLabel(r) : 'None'}</button>`
    ).join('');

    const tagNames = task.tagIds.map(tid => state.tags.find(t => t.id === tid)?.name).filter(Boolean);
    document.getElementById('detail-tags').value = tagNames.join(', ');

    this.renderSubtasks(id);
    this.bindDetailChips();

    document.getElementById('task-sheet').classList.add('open');
    document.getElementById('overlay').classList.add('open');
  },

  bindDetailChips() {
    ['priority-chips', 'category-chips', 'recurrence-chips'].forEach(id => {
      document.querySelectorAll(`#${id} .chip`).forEach(c => c.addEventListener('click', () => {
        document.querySelectorAll(`#${id} .chip`).forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
      }));
    });
  },

  renderSubtasks(parentId) {
    const subs = Store.getSubtasks(parentId);
    document.getElementById('subtask-count').textContent = `(${subs.filter(s => s.status === 'completed').length}/${subs.length})`;
    document.getElementById('subtask-list').innerHTML = subs.map(s => `
      <div class="subtask-row" data-id="${s.id}">
        <button class="task-checkbox ${s.status === 'completed' ? 'checked' : ''}" data-id="${s.id}">${Icons.check}</button>
        <input type="text" value="${Utils.escapeHtml(s.title)}" data-id="${s.id}" class="${s.status === 'completed' ? 'completed-text' : ''}" />
      </div>`).join('');
    document.getElementById('subtask-list').querySelectorAll('.task-checkbox').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleComplete(btn.dataset.id);
        this.renderSubtasks(this.currentTaskId);
      });
    });
    document.getElementById('subtask-list').querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => Store.updateTask(inp.dataset.id, { title: inp.value.trim() }));
    });
  },

  addSubtaskField() {
    if (!this.currentTaskId) return;
    const row = document.createElement('div');
    row.className = 'subtask-row';
    row.innerHTML = `<button class="task-checkbox" disabled></button><input type="text" placeholder="New subtask..." autofocus />`;
    document.getElementById('subtask-list').appendChild(row);
    const inp = row.querySelector('input');
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && inp.value.trim()) {
        Store.createTask({ title: inp.value.trim(), parentId: this.currentTaskId, dueDate: Store.getTask(this.currentTaskId)?.dueDate });
        this.renderSubtasks(this.currentTaskId);
      }
    });
    inp.focus();
  },

  saveTaskDetail() {
    if (!this.currentTaskId) return;
    const tagStr = document.getElementById('detail-tags').value;
    const tagIds = tagStr.split(',').map(t => t.trim()).filter(Boolean).map(n => Store.ensureTag(n));

    Store.updateTask(this.currentTaskId, {
      title: document.getElementById('detail-title').value.trim(),
      dueDate: document.getElementById('detail-date').value || null,
      dueTime: document.getElementById('detail-time').value || null,
      notes: document.getElementById('detail-notes').value,
      priority: document.querySelector('#priority-chips .chip.selected')?.dataset.priority || 'none',
      categoryId: document.querySelector('#category-chips .chip.selected')?.dataset.cat || null,
      recurrence: document.querySelector('#recurrence-chips .chip.selected')?.dataset.recurrence || null,
      tagIds,
    });

    this.closeSheets();
    this.refreshViews();
    this.toast('Task saved');
  },

  deleteCurrentTask() {
    if (!this.currentTaskId) return;
    const subs = Store.getSubtasks(this.currentTaskId);
    if (subs.length > 0) {
      document.getElementById('dialog-delete').classList.add('open');
      return;
    }
    this.doDeleteTask();
  },

  doDeleteTask() {
    const id = this.currentTaskId;
    const task = Store.getTask(id);
    if (!task) return;
    const subSnapshots = Store.getSubtasks(id).map(s => JSON.parse(JSON.stringify(s)));
    const taskSnapshot = JSON.parse(JSON.stringify(task));
    Store.deleteTask(id);
    this.closeSheets();
    this.refreshViews();
    this.toast('Task deleted', 'Undo', () => {
      Store.restoreDeleted(taskSnapshot);
      subSnapshots.forEach(s => Store.restoreDeleted(s));
      this.refreshViews();
    });
  },

  // Search
  openSearch() {
    document.getElementById('search-sheet').classList.add('open');
    document.getElementById('overlay').classList.add('open');
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
    setTimeout(() => document.getElementById('search-input').focus(), 100);
  },

  renderSearchResults(query) {
    const results = Store.searchTasks(query);
    const el = document.getElementById('search-results');
    if (!query.trim()) { el.innerHTML = ''; return; }
    if (!results.length) {
      el.innerHTML = `<div class="empty-state"><p>No tasks found for "${Utils.escapeHtml(query)}"</p></div>`;
      return;
    }
    el.innerHTML = `<div class="task-list">${results.map(t => this.taskRowHtml(t)).join('')}</div>`;
    this.bindTaskRowEvents(el.querySelector('.task-list'));
  },

  closeSheets() {
    document.querySelectorAll('.sheet, .dialog').forEach(s => s.classList.remove('open'));
    document.getElementById('overlay').classList.remove('open');
    this.currentTaskId = null;
    this.pendingCompleteId = null;
  },

  toast(message, actionLabel, actionFn) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${Utils.escapeHtml(message)}</span>${actionLabel ? `<button class="toast-action">${actionLabel}</button>` : ''}`;
    if (actionLabel && actionFn) {
      el.querySelector('.toast-action').addEventListener('click', () => { actionFn(); el.remove(); });
    }
    container.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  },

  toggleSection(header) {
    header.classList.toggle('collapsed');
    const list = header.nextElementSibling;
    if (list) list.classList.toggle('hidden');
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

document.addEventListener('click', e => {
  if (e.target.closest('.section-header')) {
    App.toggleSection(e.target.closest('.section-header'));
  }
  if (e.target.id === 'dialog-delete-cancel') {
    document.getElementById('dialog-delete').classList.remove('open');
  }
  if (e.target.id === 'dialog-delete-confirm') {
    document.getElementById('dialog-delete').classList.remove('open');
    App.doDeleteTask();
  }
  if (e.target.id === 'dialog-complete-cancel') {
    App.closeSheets();
  }
  if (e.target.id === 'dialog-complete-only') {
    App.doComplete(App.pendingCompleteId, false);
    App.closeSheets();
  }
  if (e.target.id === 'dialog-complete-all') {
    App.doComplete(App.pendingCompleteId, true);
    App.closeSheets();
  }
  if (e.target.id === 'dialog-clear-cancel') {
    App.closeSheets();
  }
  if (e.target.id === 'dialog-clear-confirm') {
    App.clearData();
  }
  if (e.target.id === 'sheet-close' || e.target.id === 'search-close') {
    App.closeSheets();
  }
});
