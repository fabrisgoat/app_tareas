(() => {
  'use strict';
  const KEY = 'tareas-programadas-v1';
  const $ = (id) => document.getElementById(id);
  const TAGS = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };

  let tasks = load();
  let view = 'list';
  let cursor = new Date(); cursor.setDate(1);
  let selectedDate = ymd(new Date());

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch {}
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function when(t) { return new Date(`${t.date}T${t.time || '23:59'}`); }
  function cmp(a, b) { return when(a) - when(b); }
  function fmtDate(s) {
    return new Date(`${s}T00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function taskHTML(t) {
    const overdue = !t.done && when(t) < new Date();
    return `<div class="task${t.done ? ' done' : ''}${overdue ? ' overdue' : ''}" data-id="${t.id}">
      <input type="checkbox" data-act="toggle" ${t.done ? 'checked' : ''} aria-label="Completada">
      <div class="t-body">
        <div class="t-title">${esc(t.title)}${TAGS[t.complexity] ? `<span class="tag ${t.complexity}">${TAGS[t.complexity]}</span>` : ''}</div>
        <div class="t-meta">${esc(fmtDate(t.date))}${t.time ? ' · ' + esc(t.time) : ''}${overdue ? ' · vencida' : ''}</div>
        ${t.notes ? `<div class="t-notes">${esc(t.notes)}</div>` : ''}
      </div>
      <div class="t-btns">
        <button data-act="edit" aria-label="Editar">✎</button>
        <button data-act="delete" aria-label="Eliminar">🗑</button>
      </div>
    </div>`;
  }

  function renderList() {
    const now = new Date(), today = ymd(now);
    const pending = tasks.filter((t) => !t.done).sort(cmp);
    const groups = [
      ['Vencidas', pending.filter((t) => when(t) < now)],
      ['Hoy', pending.filter((t) => when(t) >= now && t.date === today)],
      ['Próximas', pending.filter((t) => t.date > today)],
      ['Completadas', tasks.filter((t) => t.done).sort(cmp)],
    ];
    const html = groups.filter(([, l]) => l.length)
      .map(([n, l]) => `<h2 class="group">${n} (${l.length})</h2>${l.map(taskHTML).join('')}`).join('');
    $('list-view').innerHTML = html || '<p class="empty">No hay tareas. ¡Añade la primera!</p>';
  }

  function renderCalendar() {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    $('month-label').textContent = cursor.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // semana empieza en lunes
    const days = new Date(y, m + 1, 0).getDate();
    const today = ymd(new Date());
    let html = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<div class="cal-head">${d}</div>`).join('');
    for (let i = 0; i < lead; i++) html += '<button class="cal-day empty-cell" tabindex="-1" aria-hidden="true"></button>';
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${pad(m + 1)}-${pad(d)}`;
      const n = tasks.filter((t) => t.date === key && !t.done).length;
      html += `<button class="cal-day${key === today ? ' today' : ''}${key === selectedDate ? ' selected' : ''}" data-date="${key}">
        <span>${d}</span>${n ? `<span class="count">${n}</span>` : ''}</button>`;
    }
    $('calendar-grid').innerHTML = html;
    $('day-label').textContent = fmtDate(selectedDate);
    const list = tasks.filter((t) => t.date === selectedDate).sort(cmp);
    $('day-tasks').innerHTML = list.length ? list.map(taskHTML).join('') : '<p class="empty">Sin tareas este día.</p>';
  }

  function render() {
    $('list-view').hidden = view !== 'list';
    $('calendar-view').hidden = view !== 'calendar';
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'list') renderList(); else renderCalendar();
  }

  function resetForm() {
    $('task-form').reset();
    $('task-id').value = '';
    $('date').value = selectedDate;
    $('submit-btn').textContent = 'Añadir tarea';
    $('cancel-btn').hidden = true;
  }

  $('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: $('title').value.trim(), date: $('date').value,
      time: $('time').value, notes: $('notes').value.trim(),
      complexity: $('complexity').value,
    };
    if (!data.title || !data.date) return;
    const id = $('task-id').value;
    if (id) Object.assign(tasks.find((t) => t.id === id), data);
    else tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), done: false, ...data });
    save();
    selectedDate = data.date;
    cursor = new Date(`${data.date}T00:00`); cursor.setDate(1);
    resetForm(); render();
  });

  $('cancel-btn').addEventListener('click', () => { resetForm(); });

  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => { view = b.dataset.view; render(); }));

  $('prev-month').addEventListener('click', () => { cursor.setMonth(cursor.getMonth() - 1); render(); });
  $('next-month').addEventListener('click', () => { cursor.setMonth(cursor.getMonth() + 1); render(); });

  $('calendar-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-date]');
    if (!b) return;
    selectedDate = b.dataset.date;
    if (!$('task-id').value) $('date').value = selectedDate;
    render();
  });

  function onTaskClick(e) {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const el = act.closest('.task');
    const t = tasks.find((x) => x.id === el.dataset.id);
    if (!t) return;
    if (act.dataset.act === 'toggle') t.done = act.checked;
    else if (act.dataset.act === 'delete') tasks = tasks.filter((x) => x !== t);
    else if (act.dataset.act === 'edit') {
      $('task-id').value = t.id; $('title').value = t.title; $('date').value = t.date;
      $('time').value = t.time; $('notes').value = t.notes;
      $('complexity').value = t.complexity || '';
      $('submit-btn').textContent = 'Guardar cambios'; $('cancel-btn').hidden = false;
      $('title').focus(); window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    save(); render();
  }
  $('list-view').addEventListener('click', onTaskClick);
  $('day-tasks').addEventListener('click', onTaskClick);

  // Tema claro/oscuro
  const THEME_KEY = 'tareas-tema';
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function currentTheme() {
    return document.documentElement.dataset.theme || (mq.matches ? 'dark' : 'light');
  }
  function paintToggle() {
    $('theme-toggle').textContent = currentTheme() === 'dark' ? '☀️' : '🌙';
  }
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch {}
  $('theme-toggle').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    paintToggle();
  });
  paintToggle();

  setInterval(() => { if (view === 'list') renderList(); }, 60000); // actualiza "vencidas"

  resetForm();
  render();
})();
