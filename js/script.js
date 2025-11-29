const STORAGE_KEY = 'micro-habits-v1';
const habitForm = document.getElementById('habit-form');
const habitList = document.getElementById('habit-list');
const cancelEditBtn = document.getElementById('cancel-edit');
const submitBtn = document.getElementById('submit-btn');
const formTitle = document.getElementById('form-title');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');
const clearBtn = document.getElementById('clear-btn');

const statHabits = document.getElementById('stat-habits');
const statWeek = document.getElementById('stat-week');
const statBest = document.getElementById('stat-best');

let habits = loadHabits();
let editingId = null;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(a, b) {
  return a.slice(0, 10) === b.slice(0, 10);
}

function startOfWeekISO(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to parse storage', e);
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function setForm(habit) {
  habitForm.name.value = habit?.name || '';
  habitForm.category.value = habit?.category || '';
  habitForm.target.value = habit?.target || 3;
  habitForm.color.value = habit?.color || '#6b8afd';
}

function resetForm() {
  editingId = null;
  formTitle.textContent = 'Add a habit';
  submitBtn.textContent = 'Save habit';
  cancelEditBtn.hidden = true;
  setForm({});
}

function handleSubmit(e) {
  e.preventDefault();
  const data = {
    name: habitForm.name.value.trim(),
    category: habitForm.category.value.trim(),
    target: Math.max(1, Math.min(7, Number(habitForm.target.value) || 1)),
    color: habitForm.color.value || '#6b8afd',
  };
  if (!data.name) return;

  if (editingId) {
    habits = habits.map((h) => (h.id === editingId ? { ...h, ...data } : h));
  } else {
    habits.push({ id: uid(), ...data, entries: [] });
  }
  saveHabits();
  render();
  resetForm();
}

function handleEdit(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  editingId = id;
  formTitle.textContent = 'Edit habit';
  submitBtn.textContent = 'Update habit';
  cancelEditBtn.hidden = false;
  setForm(habit);
}

function handleDelete(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  const ok = confirm(`Delete "${habit.name}"? This removes its history.`);
  if (!ok) return;
  habits = habits.filter((h) => h.id !== id);
  saveHabits();
  render();
  if (editingId === id) resetForm();
}

function toggleToday(id) {
  const today = todayISO();
  habits = habits.map((h) => {
    if (h.id !== id) return h;
    const exists = (h.entries || []).some((d) => sameDay(d, today));
    const entries = exists ? h.entries.filter((d) => !sameDay(d, today)) : [...(h.entries || []), today];
    return { ...h, entries };
  });
  saveHabits();
  render();
}

function calcStreak(entries = []) {
  const unique = [...new Set(entries.map((d) => d.slice(0, 10)))].sort();
  if (!unique.length) return { current: 0, best: 0 };

  // best streak across history
  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const diff = dayDiff(unique[i - 1], unique[i]);
    if (diff === 1) {
      run += 1;
    } else if (diff === 0) {
      continue; // duplicate day
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }

  // current streak ending today/yesterday
  const today = todayISO();
  let current = 0;
  for (let i = unique.length - 1; i >= 0; i--) {
    const date = unique[i];
    if (current === 0) {
      if (date === today || date === addDaysISO(today, -1)) {
        current = 1;
      } else {
        break;
      }
    } else {
      const diff = dayDiff(date, unique[i + 1] || today);
      if (diff === 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, best };
}

function addDaysISO(dateISO, days) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayDiff(aISO, bISO) {
  const a = new Date(aISO);
  const b = new Date(bISO);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function countWeek(entries = []) {
  const start = startOfWeekISO();
  return entries.filter((d) => d >= start).length;
}

function renderStats() {
  statHabits.textContent = habits.length;
  let weekTotal = 0;
  let best = 0;
  habits.forEach((h) => {
    const { best: b } = calcStreak(h.entries);
    best = Math.max(best, b);
    weekTotal += countWeek(h.entries);
  });
  statWeek.textContent = weekTotal;
  statBest.textContent = best;
}

function render() {
  habitList.innerHTML = '';
  if (!habits.length) {
    habitList.innerHTML = '<p class="empty">No habits yet. Add one to start logging check-ins.</p>';
    renderStats();
    return;
  }

  const template = document.getElementById('habit-template');
  habits.forEach((habit) => {
    const node = template.content.cloneNode(true);
    node.querySelector('.habit-name').textContent = habit.name;
    node.querySelector('.habit-subtitle').textContent = `${habit.category || 'General'} • Target ${habit.target}/week`;
    node.querySelector('.color-dot').style.background = habit.color;

    const { current, best } = calcStreak(habit.entries);
    node.querySelector('.current-streak').textContent = current;
    node.querySelector('.best-streak').textContent = best;
    node.querySelector('.week-count').textContent = countWeek(habit.entries);

    const loggedToday = (habit.entries || []).some((d) => sameDay(d, todayISO()));
    const logBtn = node.querySelector('.log-btn');
    logBtn.textContent = loggedToday ? 'Undo today' : 'Log today';
    logBtn.classList.toggle('primary', !loggedToday);
    logBtn.onclick = () => toggleToday(habit.id);

    node.querySelector('.edit-btn').onclick = () => handleEdit(habit.id);
    node.querySelector('.delete-btn').onclick = () => handleDelete(habit.id);

    habitList.appendChild(node);
  });
  renderStats();
}

function exportData() {
  const blob = new Blob([JSON.stringify(habits, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habit-export-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Invalid file');
      habits = data.map((h) => ({ ...h, entries: h.entries || [] }));
      saveHabits();
      render();
    } catch (err) {
      alert('Could not import this file. Make sure it is a valid export.');
    }
  };
  reader.readAsText(file);
}

habitForm.addEventListener('submit', handleSubmit);

cancelEditBtn.addEventListener('click', resetForm);

exportBtn.addEventListener('click', exportData);

importFile.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) importData(file);
});

clearBtn.addEventListener('click', () => {
  if (!habits.length) return;
  const ok = confirm('Reset all habits and history?');
  if (!ok) return;
  habits = [];
  saveHabits();
  render();
  resetForm();
});

/* ========== VIEW TOGGLE SECTION ========== */

// Get the view toggle buttons
var gridViewBtn = document.getElementById('grid-view-btn');
var listViewBtn = document.getElementById('list-view-btn');

// Function to set a cookie
function setCookie(name, value, days) {
  var date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  var expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// Function to get a cookie
function getCookie(name) {
  var cookieName = name + "=";
  var cookies = document.cookie.split(';');
  for (var i = 0; i < cookies.length; i++) {
    var cookie = cookies[i].trim();
    if (cookie.indexOf(cookieName) === 0) {
      return cookie.substring(cookieName.length, cookie.length);
    }
  }
  return "";
}

// Function to switch to grid view
function switchToGridView() {
  habitList.classList.remove('list-view');
  gridViewBtn.classList.add('active');
  listViewBtn.classList.remove('active');
  setCookie('habitViewStyle', 'grid', 365);
}

// Function to switch to list view
function switchToListView() {
  habitList.classList.add('list-view');
  listViewBtn.classList.add('active');
  gridViewBtn.classList.remove('active');
  setCookie('habitViewStyle', 'list', 365);
}

// Add click event to grid view button
gridViewBtn.addEventListener('click', function() {
  switchToGridView();
});

// Add click event to list view button
listViewBtn.addEventListener('click', function() {
  switchToListView();
});

// Load saved view style from cookie when page loads
function loadSavedViewStyle() {
  var savedView = getCookie('habitViewStyle');
  if (savedView === 'list') {
    switchToListView();
  } else {
    switchToGridView();
  }
}

// Call the function to load saved view style
loadSavedViewStyle();

/* ========== END VIEW TOGGLE SECTION ========== */

render();
