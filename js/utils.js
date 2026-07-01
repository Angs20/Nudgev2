const Utils = {
  todayStr() {
    return this.dateToStr(new Date());
  },

  dateToStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  parseDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  formatDate(str, opts = {}) {
    if (!str) return '';
    const d = this.parseDate(str);
    const today = this.todayStr();
    const tomorrow = this.dateToStr(new Date(Date.now() + 86400000));
    if (str === today && !opts.alwaysFull) return 'Today';
    if (str === tomorrow && !opts.alwaysFull) return 'Tomorrow';
    return d.toLocaleDateString('en', { weekday: opts.weekday ? 'short' : undefined, month: 'short', day: 'numeric' });
  },

  formatTime(time) {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  },

  formatHeaderDate() {
    return new Date().toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  greeting(name) {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return name ? `${part}, ${name.split(' ')[0]}` : part;
  },

  isOverdue(task) {
    if (!task.dueDate || task.status === 'completed') return false;
    return task.dueDate < this.todayStr();
  },

  isToday(task) {
    return task.dueDate === this.todayStr();
  },

  isFuture(task) {
    return task.dueDate && task.dueDate > this.todayStr();
  },

  getWeekRange(offset = 0) {
    const state = Store.getState();
    const weekStart = state.settings.weekStart;
    const now = new Date();
    now.setDate(now.getDate() + offset * 7);
    const day = now.getDay();
    const diff = (day - weekStart + 7) % 7;
    const start = new Date(now);
    start.setDate(start.getDate() - diff);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push({
        date: this.dateToStr(d),
        label: d.toLocaleDateString('en', { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: this.dateToStr(d) === this.todayStr(),
      });
    }
    const end = days[6];
    const rangeLabel = `${this.formatDate(days[0].date, { alwaysFull: true })} – ${this.formatDate(end.date, { alwaysFull: true })}`;
    return { days, rangeLabel, start: days[0].date, end: end.date };
  },

  nextRecurrenceDate(currentDate, recurrence) {
    if (!currentDate || !recurrence) return null;
    const d = this.parseDate(currentDate);
    if (recurrence === 'daily') {
      d.setDate(d.getDate() + 1);
    } else if (recurrence === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (recurrence === 'weekdays') {
      do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
    } else if (recurrence === 'monthly') {
      const day = d.getDate();
      d.setMonth(d.getMonth() + 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, lastDay));
    }
    return this.dateToStr(d);
  },

  recurrenceLabel(recurrence) {
    const labels = { daily: 'Daily', weekly: 'Weekly', weekdays: 'Weekdays', monthly: 'Monthly' };
    return labels[recurrence] || 'None';
  },

  priorityColor(p) {
    return {
      none: 'var(--priority-none)',
      low: 'var(--priority-low)',
      medium: 'var(--priority-medium)',
      high: 'var(--priority-high)',
    }[p] || 'var(--priority-none)';
  },

  priorityOrder(p) {
    return { high: 0, medium: 1, low: 2, none: 3 }[p] ?? 3;
  },

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  passwordStrength(password) {
    if (!password) return { score: 0, label: '', width: '0%' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const levels = [
      { label: 'Too weak', width: '20%', class: 'weak' },
      { label: 'Weak', width: '40%', class: 'weak' },
      { label: 'Fair', width: '60%', class: 'fair' },
      { label: 'Good', width: '80%', class: 'good' },
      { label: 'Strong', width: '100%', class: 'strong' },
    ];
    const idx = Math.min(Math.max(score - 1, 0), levels.length - 1);
    return { score, ...levels[idx] };
  },

  filterTasks(tasks, filters) {
    return tasks.filter(t => {
      if (filters.category && t.categoryId !== filters.category) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.status === 'active' && t.status !== 'active') return false;
      if (filters.status === 'completed' && t.status !== 'completed') return false;
      return true;
    });
  },

  sortTasks(tasks, sortBy) {
    const sorted = [...tasks];
    if (sortBy === 'dueDate') {
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return a.position - b.position;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        const cmp = a.dueDate.localeCompare(b.dueDate);
        return cmp !== 0 ? cmp : (a.dueTime || '').localeCompare(b.dueTime || '');
      });
    } else if (sortBy === 'priority') {
      sorted.sort((a, b) => {
        const diff = this.priorityOrder(a.priority) - this.priorityOrder(b.priority);
        return diff !== 0 ? diff : a.position - b.position;
      });
    } else if (sortBy === 'created') {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      sorted.sort((a, b) => a.position - b.position);
    }
    return sorted;
  },

  hasActiveFilters(filters) {
    return !!(filters.category || filters.priority || filters.status);
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },
};

const Icons = {
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
  plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  today: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  planner: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  stats: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  profile: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  chevron: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  flame: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.9 0-7-3.1-7-7 0-2.5 1.5-4.5 3-6 .5 2 2 3.5 3.5 3.5C13 11.5 14 8 14 6c3 2.5 5 5.5 5 10 0 3.9-3.1 7-7 7z"/></svg>',
  grip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
  google: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
};

function mascotSvg(size = 80, mood = 'happy') {
  const mouths = {
    happy: 'M28 46 Q40 54 52 46',
    celebrate: 'M26 44 Q40 56 54 44',
    calm: 'M30 48 Q40 52 50 48',
  };
  return `<svg class="mascot" width="${size}" height="${size}" viewBox="0 0 80 80" aria-hidden="true">
    <defs><linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E8833A"/><stop offset="100%" stop-color="#4A90D9"/></linearGradient></defs>
    <ellipse cx="40" cy="44" rx="28" ry="26" fill="url(#mg)" opacity=".9"/>
    <ellipse cx="40" cy="42" rx="24" ry="22" fill="#FBE6D4"/>
    <circle cx="30" cy="38" r="3" fill="#1F2933"/>
    <circle cx="50" cy="38" r="3" fill="#1F2933"/>
    <path d="${mouths[mood] || mouths.happy}" fill="none" stroke="#1F2933" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="58" cy="50" rx="8" ry="5" fill="#E8833A" opacity=".6" transform="rotate(-20 58 50)"/>
  </svg>`;
}
