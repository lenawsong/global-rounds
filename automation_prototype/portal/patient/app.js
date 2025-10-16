const state = {
  token: new URLSearchParams(window.location.search).get('token') || '',
  apiBase: new URLSearchParams(window.location.search).get('api') || window.localStorage.getItem('gr-api-base') || 'http://localhost:8001',
  session: null,
};

const elements = {
  summary: document.getElementById('order-summary'),
  timeline: document.getElementById('timeline'),
  btnConfirm: document.getElementById('btn-confirm'),
  btnReschedule: document.getElementById('btn-reschedule'),
  btnHelp: document.getElementById('btn-help'),
  notesContainer: document.getElementById('notes-container'),
  notesInput: document.getElementById('notes'),
  btnSubmitNote: document.getElementById('btn-submit-note'),
  btnCancelNote: document.getElementById('btn-cancel-note'),
  statusCard: document.getElementById('status-card'),
  statusMessage: document.getElementById('status-message'),
  toastStack: document.getElementById('toast-stack'),
};

if (state.apiBase) {
  try {
    window.localStorage.setItem('gr-api-base', state.apiBase);
  } catch (error) {
    console.warn('Unable to persist API base.', error);
  }
}

async function init() {
  if (!state.token) {
    setStatus('Invalid or missing link. Please contact support.', 'error');
    return;
  }
  try {
    const session = await fetchJson(`/api/patient-links/${encodeURIComponent(state.token)}`);
    state.session = session;
    renderSession(session);
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function fetchJson(path, options = {}) {
  const base = state.apiBase.replace(/\/$/, '');
  const opts = {
    method: 'GET',
    headers: { Accept: 'application/json' },
    ...options,
  };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${base}${path}`, opts);
  if (!response.ok) {
    const text = await response.text();
    let detail;
    try {
      detail = text ? JSON.parse(text).detail : response.statusText;
    } catch (error) {
      detail = response.statusText;
    }
    throw new Error(detail || 'Request failed');
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function renderSession(session) {
  if (elements.summary) {
    const summary = session.order_summary || {};
    const sku = summary.supply_sku || 'Unknown supply';
    const requested = summary.requested_date ? new Date(summary.requested_date).toLocaleDateString() : 'TBD';
    elements.summary.textContent = `${sku} • Requested for ${requested}`;
  }
  renderTimeline(session);
  setStatus('How can we help with your order today?', 'info');
}

function renderTimeline(session) {
  if (!elements.timeline) {
    return;
  }
  const summary = session.order_summary || {};
  const notes = summary.ai_notes || [];
  elements.timeline.innerHTML = `
    <div class="timeline-item"><strong>Order ID:</strong> ${escapeHtml(summary.order_id || '—')}</div>
    <div class="timeline-item"><strong>Status:</strong> ${escapeHtml(summary.status || 'Pending')}</div>
    ${notes.length ? `<div class="timeline-item"><strong>Notes:</strong> ${escapeHtml(notes.join('; '))}</div>` : ''}
  `;
}

function attachHandlers() {
  elements.btnConfirm?.addEventListener('click', () => submitAction('confirm_delivery'));
  elements.btnReschedule?.addEventListener('click', () => showNotes('reschedule'));
  elements.btnHelp?.addEventListener('click', () => showNotes('needs_help'));
  elements.btnCancelNote?.addEventListener('click', hideNotes);
  elements.btnSubmitNote?.addEventListener('click', submitNotes);
}

function showNotes(action) {
  state.pendingAction = action;
  elements.notesContainer?.classList.remove('hidden');
  elements.notesInput?.focus();
}

function hideNotes() {
  state.pendingAction = null;
  if (elements.notesContainer) {
    elements.notesContainer.classList.add('hidden');
  }
  if (elements.notesInput) {
    elements.notesInput.value = '';
  }
}

async function submitAction(action, notes = '') {
  try {
    await fetchJson('/api/patient-actions', {
      method: 'POST',
      body: { token: state.token, action, notes },
    });
    setStatus(actionMessage(action), 'success');
    notify('We received your update. Thank you!', 'success');
    hideNotes();
  } catch (error) {
    notify(error.message, 'error');
  }
}

function actionMessage(action) {
  if (action === 'confirm_delivery') {
    return 'Thanks for confirming! Your care team has been notified.';
  }
  if (action === 'reschedule') {
    return 'A team member will reach out shortly to reschedule.';
  }
  return 'We have alerted your care team to assist you.';
}

function submitNotes() {
  const notes = elements.notesInput?.value || '';
  if (!state.pendingAction) {
    return;
  }
  submitAction(state.pendingAction, notes);
}

function setStatus(message, variant = 'info') {
  if (!elements.statusCard || !elements.statusMessage) {
    return;
  }
  elements.statusCard.classList.remove('hidden');
  elements.statusMessage.textContent = message;
  notify(message, variant);
}

function notify(message, variant = 'info') {
  if (!elements.toastStack || !message) {
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.textContent = message;
  elements.toastStack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => dismissToast(toast), 4000);
}

function dismissToast(toast) {
  if (!toast) {
    return;
  }
  toast.classList.remove('visible');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  setTimeout(() => toast.remove(), 500);
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

attachHandlers();
init();
