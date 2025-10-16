const savedBase = (() => {
  try {
    return window.localStorage.getItem('gr-portal-api-base') || '';
  } catch (error) {
    console.warn('Unable to access localStorage for API base persistence.', error);
    return '';
  }
})();

const defaultBase = document.body.dataset.apiBase?.trim() || savedBase || 'http://localhost:8001';

const state = {
  apiBase: defaultBase,
  orders: [],
  tasks: [],
  lastTaskIds: new Set(),
  highlightedTaskIds: new Set(),
  submitting: false,
  loading: false,
  clinicianMode: false,
  selectedTaskId: null,
  providerTasks: [],
};

const elements = {
  form: document.getElementById('order-form'),
  submitButton: document.getElementById('submit-order'),
  formFeedback: document.getElementById('form-feedback'),
  orderList: document.getElementById('order-list'),
  orderCount: document.getElementById('order-count'),
  refreshBtn: document.getElementById('refresh-orders'),
  toastStack: document.getElementById('toast-stack'),
  taskList: document.getElementById('task-list'),
  taskCount: document.getElementById('task-count'),
  copilotList: document.getElementById('copilot-list'),
  copilotCount: document.getElementById('copilot-count'),
  toggleClinician: document.getElementById('toggle-clinician'),
  drawer: document.getElementById('clinician-drawer'),
  drawerTitle: document.getElementById('drawer-title'),
  drawerBody: document.getElementById('drawer-body'),
  drawerClose: document.getElementById('drawer-close'),
  drawerStart: document.getElementById('drawer-start'),
  drawerComplete: document.getElementById('drawer-complete'),
  drawerDownload: document.getElementById('drawer-download'),
  drawerF2F: document.getElementById('drawer-f2f'),
  drawerEsign: document.getElementById('drawer-esign'),
  drawerLink: document.getElementById('drawer-link'),
};

if (state.apiBase) {
  try {
    window.localStorage.setItem('gr-portal-api-base', state.apiBase);
  } catch (error) {
    console.warn('Unable to persist API base.', error);
  }
}

function apiUrl(path) {
  return `${state.apiBase.replace(/\/$/, '')}${path}`;
}

async function fetchJson(path, options = {}) {
  const opts = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    ...options,
  };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
    opts.headers['Content-Type'] = 'application/json';
  }
  try {
    const response = await fetch(apiUrl(path), opts);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = payload?.detail || response.statusText || 'Request failed';
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    throw new Error(error.message || 'Network error');
  }
}

async function loadOrders({ showToast = false } = {}) {
  state.loading = true;
  try {
    const result = await fetchJson('/api/portal/orders');
    state.orders = Array.isArray(result.orders) ? result.orders : [];
    renderOrders();
    await loadTasks({ silent: true });
    if (showToast) {
      notify('Orders refreshed.', 'info');
    }
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    state.loading = false;
  }
}

async function loadTasks({ silent = false } = {}) {
  try {
    const response = await fetchJson('/api/tasks');
    const tasks = Array.isArray(response.tasks) ? response.tasks : [];
    const previousIds = new Set(Array.from(state.lastTaskIds || []));
    const newTasks = tasks.filter((task) => !previousIds.has(task.id));
    state.tasks = tasks;
    state.lastTaskIds = new Set(tasks.map((task) => task.id));
    state.highlightedTaskIds = new Set(newTasks.map((task) => task.id));
    renderTasks();
    if (state.clinicianMode) {
      await loadProviderTasks({ silent: true });
    } else {
      state.providerTasks = [];
      renderProviderTasks();
    }
    if (!silent && newTasks.length) {
      const highPriority = newTasks.filter((task) => String(task.priority || '').toLowerCase() === 'high');
      const message = highPriority.length
        ? `${newTasks.length} new tasks (${highPriority.length} high priority).`
        : `${newTasks.length} new tasks added.`;
      notify(message, highPriority.length ? 'error' : 'info');
    }
  } catch (error) {
    if (!silent) {
      notify(error.message, 'error');
    }
  }
}

async function loadProviderTasks({ silent = false } = {}) {
  if (!state.clinicianMode) {
    state.providerTasks = [];
    renderProviderTasks();
    return;
  }
  try {
    const response = await fetchJson('/api/provider/co-pilot');
    state.providerTasks = Array.isArray(response.tasks) ? response.tasks : [];
    renderProviderTasks();
  } catch (error) {
    state.providerTasks = [];
    renderProviderTasks();
    if (!silent) {
      notify(error.message, 'error');
    }
  }
}

function handleSubmit(event) {
  event.preventDefault();
  if (state.submitting) {
    return;
  }
  const formData = new FormData(elements.form);
  const payload = Object.fromEntries(formData.entries());
  payload.quantity = Number(payload.quantity || 0);
  if (!payload.patient_id || !payload.supply_sku || !payload.quantity) {
    notify('Please complete patient, SKU, and quantity fields.', 'error');
    return;
  }
  if (payload.delivery_mode === 'auto') {
    payload.delivery_mode = null;
  }
  state.submitting = true;
  setSubmitting(true);
  submitOrder(payload)
    .then((order) => {
      elements.form.reset();
      elements.formFeedback.innerHTML = `<strong>Submitted.</strong> AI disposition: ${order.ai_disposition} (${order.status}).`;
      notify('Order submitted to automation pipeline.', 'success');
      state.orders.unshift(order);
      renderOrders();
    })
    .catch((error) => {
      elements.formFeedback.textContent = error.message;
      notify(error.message, 'error');
    })
    .finally(() => {
      state.submitting = false;
      setSubmitting(false);
    });
}

async function submitOrder(payload) {
  const response = await fetchJson('/api/portal/orders', {
    method: 'POST',
    body: payload,
  });
  return response;
}

function setSubmitting(flag) {
  if (!elements.submitButton) {
    return;
  }
  elements.submitButton.disabled = flag;
  elements.submitButton.textContent = flag ? 'Submitting…' : 'Submit Order';
}

function renderOrders() {
  if (!elements.orderList) {
    return;
  }
  const orders = state.orders;
  elements.orderCount.textContent = `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`;
  if (!orders.length) {
    elements.orderList.innerHTML = '<li class="order-item">No orders submitted yet.</li>';
    return;
  }
  elements.orderList.innerHTML = orders
    .map((order) => orderItemTemplate(order))
    .join('');

  Array.from(document.querySelectorAll('[data-approve]')).forEach((button) => {
    button.addEventListener('click', () => approveOrder(button.dataset.approve));
  });
}

function renderTasks() {
  if (!elements.taskList) {
    return;
  }

  const tasks = state.tasks || [];
  const filtered = state.clinicianMode
    ? tasks.filter((task) => (task.task_type || '').startsWith('compliance'))
    : tasks;
  const highlightIds = state.highlightedTaskIds || new Set();
  if (elements.taskCount) {
    elements.taskCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'task' : 'tasks'}`;
  }

  if (!filtered.length) {
    elements.taskList.innerHTML = '<li class="order-item">No open tasks assigned.</li>';
    return;
  }

  elements.taskList.innerHTML = filtered
    .map((task) => {
      const status = String(task.status || '').toLowerCase();
      const metadata = task.metadata || {};
      const noteSource = metadata.notes || (Array.isArray(metadata.ai_notes) ? metadata.ai_notes.join('; ') : '') || metadata.message || '';
      const due = task.due_at ? new Date(task.due_at).toLocaleString() : '—';
      const actions = renderTaskActions(task);
      const highlightClass = highlightIds.has(task.id) ? 'order-item task-item-new' : 'order-item';
      return `
        <li class="${highlightClass}" data-task-id="${task.id}">
          <div class="order-head">
            <h3>${escapeHtml(task.title)}</h3>
            <span class="status-tag status-${status}">${escapeHtml(task.status)}</span>
          </div>
          <div class="order-meta">
            <span>${escapeHtml(task.task_type)}</span>
            <span>Priority ${escapeHtml(task.priority)}</span>
            <span>Due ${escapeHtml(due)}</span>
          </div>
          <p class="order-notes">${escapeHtml(noteSource)}</p>
          <div class="order-actions">${actions}</div>
        </li>
      `;
    })
    .join('');

  Array.from(document.querySelectorAll('[data-task-action]')).forEach((button) => {
    button.addEventListener('click', () => {
      const { taskId, taskAction } = button.dataset;
      updateTaskStatus(taskId, taskAction);
    });
  });

  if (state.clinicianMode) {
    elements.taskList.querySelectorAll('li[data-task-id]').forEach((item) => {
      item.addEventListener('click', (event) => {
        if (event.target?.dataset?.taskAction) {
          return;
        }
        openTaskDrawer(item.dataset.taskId);
      });
    });
  }

  if (highlightIds.size) {
    setTimeout(() => {
      state.highlightedTaskIds = new Set();
      document.querySelectorAll('.task-item-new').forEach((item) => item.classList.remove('task-item-new'));
    }, 2000);
  }
}

function renderProviderTasks() {
  if (!elements.copilotList) {
    return;
  }
  if (!state.clinicianMode) {
    elements.copilotList.innerHTML = '<li class="order-item">Enable clinician mode to view compliance tasks.</li>';
    if (elements.copilotCount) {
      elements.copilotCount.textContent = '0 tasks';
    }
    return;
  }
  const tasks = state.providerTasks || [];
  if (elements.copilotCount) {
    elements.copilotCount.textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
  }
  if (!tasks.length) {
    elements.copilotList.innerHTML = '<li class="order-item">All compliance tasks are complete.</li>';
    return;
  }
  elements.copilotList.innerHTML = tasks
    .map((task) => {
      const status = String(task.status || '').toLowerCase();
      const risk = (task.guardrail?.risk_level || 'medium').toLowerCase();
      const due = task.due_at ? new Date(task.due_at).toLocaleString() : '—';
      const breachReason = task.metadata?.breach_reason || task.metadata?.details;
      const summary = task.guardrail?.summary || breachReason || 'Review documentation requirements.';
      return `
        <li class="order-item" data-provider-task="true" data-task-id="${task.task_id}">
          <div class="order-head">
            <h3>${escapeHtml(task.patient_id || 'Patient')} · ${escapeHtml(task.supply_sku || 'SKU')}</h3>
            <span class="status-tag status-${escapeHtml(status)}">${escapeHtml(task.status || 'open')}</span>
          </div>
          <div class="order-meta">
            <span>Due ${escapeHtml(due)}</span>
            <span>Risk ${escapeHtml(risk)}</span>
          </div>
          <p class="order-notes">${escapeHtml(summary)}</p>
        </li>
      `;
    })
    .join('');
  elements.copilotList.querySelectorAll('[data-provider-task="true"]').forEach((item) => {
    item.addEventListener('click', () => openTaskDrawer(item.dataset.taskId));
  });
}

function renderTaskActions(task) {
  const status = String(task.status || '').toLowerCase();
  const actions = [];
  if (status === 'open') {
    actions.push(`<button class="ghost" type="button" data-task-id="${task.id}" data-task-action="start">Start</button>`);
  }
  if (status === 'open' || status === 'in_progress') {
    actions.push(`<button class="ghost" type="button" data-task-id="${task.id}" data-task-action="close">Close</button>`);
  }
  return actions.join(' ');
}

function setClinicianMode(enabled) {
  state.clinicianMode = enabled;
  state.selectedTaskId = null;
  if (elements.toggleClinician) {
    elements.toggleClinician.textContent = `Clinician Mode: ${enabled ? 'On' : 'Off'}`;
  }
  document.body.dataset.clinicianMode = enabled ? 'true' : 'false';
  closeTaskDrawer();
  renderTasks();
  renderProviderTasks();
  if (enabled) {
    loadProviderTasks({ silent: true });
  }
}

function getTaskById(taskId) {
  return (state.tasks || []).find((task) => task.id === taskId);
}

function getProviderTask(taskId) {
  return (state.providerTasks || []).find((task) => task.task_id === taskId);
}

function openTaskDrawer(taskId) {
  if (!state.clinicianMode || !elements.drawer) {
    return;
  }
  const task = getTaskById(taskId);
  if (!task) {
    closeTaskDrawer();
    return;
  }
  const providerTask = getProviderTask(taskId);
  state.selectedTaskId = taskId;
  elements.drawer.setAttribute('aria-hidden', 'false');
  if (elements.drawerTitle) {
    elements.drawerTitle.textContent = task.title || 'Task Detail';
  }
  if (elements.drawerBody) {
    elements.drawerBody.innerHTML = renderDrawerBody(task, providerTask);
  }
  if (elements.drawerStart) {
    elements.drawerStart.dataset.taskId = task.id;
  }
  if (elements.drawerComplete) {
    elements.drawerComplete.dataset.taskId = task.id;
  }
  if (elements.drawerDownload) {
    elements.drawerDownload.dataset.taskId = task.id;
    elements.drawerDownload.dataset.formUrl = providerTask?.form_url || '';
  }
  if (elements.drawerF2F) {
    elements.drawerF2F.dataset.taskId = task.id;
  }
  if (elements.drawerEsign) {
    elements.drawerEsign.dataset.taskId = task.id;
  }
  if (elements.drawerLink) {
    elements.drawerLink.dataset.taskId = task.id;
  }
}

function closeTaskDrawer() {
  if (elements.drawer) {
    elements.drawer.setAttribute('aria-hidden', 'true');
  }
}

function renderDrawerBody(task, providerTask) {
  const metadata = task.metadata || {};
  const fields = {
    'Task Type': task.task_type || '—',
    Priority: task.priority || '—',
    Status: task.status || '—',
    'Patient ID': metadata.patient_id || '—',
    'Supply SKU': metadata.supply_sku || '—',
    'Target Date': metadata.target_date || '—',
    Notes: metadata.notes || (Array.isArray(metadata.ai_notes) ? metadata.ai_notes.join('\n') : ''),
  };
  const rows = Object.entries(fields)
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd>`)
    .join('');
  const guardrail = providerTask?.guardrail;
  const guardrailBlock = guardrail
    ? `
      <section class="drawer-guardrail">
        <h3>Summary · ${escapeHtml((guardrail.risk_level || 'medium').toUpperCase())}</h3>
        <p>${escapeHtml(guardrail.summary || '')}</p>
      </section>
    `
    : '';
  return `<dl>${rows}</dl>${guardrailBlock}`;
}

async function downloadWopdStub(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    return;
  }
  const providerTask = getProviderTask(taskId);
  const metadata = task.metadata || {};
  const patientId = metadata.patient_id || 'UNKNOWN';
  const supplySku = metadata.supply_sku || 'UNKNOWN';
  try {
    const formPath = providerTask?.form_url
      || `/api/provider/forms/wopd?patient_id=${encodeURIComponent(patientId)}&supply_sku=${encodeURIComponent(supplySku)}`;
    const response = await fetchJson(formPath);
    const html = response.html || '<p>No template available.</p>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WOPD-${patientId}-${supplySku}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function downloadF2fLetter(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    return;
  }
  const metadata = task.metadata || {};
  const params = new URLSearchParams({
    patient_id: metadata.patient_id || 'UNKNOWN',
    supply_sku: metadata.supply_sku || 'UNKNOWN',
  });
  if (metadata.target_date) {
    params.set('encounter_date', metadata.target_date);
  }
  try {
    const response = await fetchJson(`/api/provider/forms/f2f?${params.toString()}`);
    const html = response.html || '<p>No template available.</p>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `F2F-${params.get('patient_id')}-${params.get('supply_sku')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('Face-to-face letter downloaded.', 'info');
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function requestEsignEnvelope(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    return;
  }
  const metadata = task.metadata || {};
  const body = {
    task_id: taskId,
    patient_id: metadata.patient_id || undefined,
    supply_sku: metadata.supply_sku || undefined,
  };
  try {
    const signerName = prompt('Signer name (optional)');
    if (signerName) {
      body.signer_name = signerName;
    }
    const signerEmail = prompt('Signer email (optional)');
    if (signerEmail) {
      body.signer_email = signerEmail;
    }
    const response = await fetchJson('/api/provider/esign', {
      method: 'POST',
      body,
    });
    notify(`E-sign envelope ${response.envelope_id} sent.`, 'info');
    if (response.sign_url) {
      window.open(response.sign_url, '_blank', 'noopener');
    }
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function createPatientLink(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    notify('Task not found.', 'error');
    return;
  }
  const metadata = task.metadata || {};
  const patientId = metadata.patient_id;
  const orderId = metadata.order_id;
  if (!patientId || !orderId) {
    notify('Missing patient or order details.', 'error');
    return;
  }
  try {
    const payload = await fetchJson('/api/patient-links', {
      method: 'POST',
      body: { patient_id: patientId, order_id: orderId },
    });
    const url = new URL(window.location.origin + '/portal/patient/');
    url.searchParams.set('token', payload.token);
    url.searchParams.set('api', state.apiBase);
    await navigator.clipboard?.writeText(url.toString());
    notify('Patient link copied to clipboard.', 'success');
  } catch (error) {
    notify(error.message, 'error');
  }
}

function orderItemTemplate(order) {
  const statusClass = `status-${(order.status || '').replace(/\s+/g, '_')}`;
  const aiNotes = Array.isArray(order.ai_notes) && order.ai_notes.length
    ? order.ai_notes.join('; ')
    : 'No additional findings.';
  const created = order.created_at ? new Date(order.created_at).toLocaleString() : '';
  const fulfillment = order.delivery_mode || order.recommended_fulfillment || 'auto';
  const quantityBadge = order.recommended_quantity && order.recommended_quantity !== order.quantity
    ? `<span>AI qty ${escapeHtml(order.recommended_quantity)}</span>`
    : '';
  const approveButton =
    order.status !== 'approved'
      ? `<button class="ghost" type="button" data-approve="${order.id}">Approve</button>`
      : '';

  return `
    <li class="order-item">
      <div class="order-head">
        <h3>${escapeHtml(order.patient_id)} · ${escapeHtml(order.supply_sku)}</h3>
        <span class="status-tag ${statusClass}">${escapeHtml(order.status || 'pending')}</span>
      </div>
      <div class="order-meta">
        <span>Qty ${escapeHtml(order.quantity)}</span>
        <span>Priority ${escapeHtml(order.priority || 'routine')}</span>
        <span>Delivery ${escapeHtml(fulfillment)}</span>
        ${order.requested_date ? `<span>Req ${escapeHtml(order.requested_date)}</span>` : ''}
        ${quantityBadge}
      </div>
      <p class="order-notes">AI disposition: <strong>${escapeHtml(order.ai_disposition)}</strong> – ${escapeHtml(aiNotes)}</p>
      <p class="order-notes">Created ${escapeHtml(created)}</p>
      <div class="order-actions">
        ${approveButton}
      </div>
    </li>
  `;
}

async function approveOrder(orderId) {
  if (!orderId) {
    return;
  }
  try {
    const updated = await fetchJson(`/api/portal/orders/${orderId}/approve`, {
      method: 'POST',
    });
    state.orders = state.orders.map((order) => (order.id === orderId ? updated : order));
    renderOrders();
    notify(`Order ${orderId} approved.`, 'success');
    await loadTasks({ silent: true });
  } catch (error) {
    notify(error.message, 'error');
  }
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
  const remove = () => {
    toast.removeEventListener('transitionend', remove);
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  };
  toast.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, 500);
}

async function updateTaskStatus(taskId, action) {
  if (!taskId || !action) {
    return;
  }
  try {
    if (action === 'start') {
      await fetchJson(`/api/tasks/${taskId}/acknowledge`, {
        method: 'POST',
        body: {},
      });
      notify(`Task ${taskId} acknowledged.`, 'info');
    } else if (action === 'close') {
      const providerTask = getProviderTask(taskId);
      if (state.clinicianMode && providerTask) {
        const noteInput = prompt('Add completion note (optional)', providerTask.metadata?.breach_reason || '');
        const payload = {
          notes: noteInput || undefined,
          owner: 'provider',
        };
        await fetchJson(`/api/provider/tasks/${taskId}/complete`, {
          method: 'POST',
          body: payload,
        });
        notify(`Task ${taskId} cleared and order approved.`, 'success');
      } else {
        await fetchJson(`/api/tasks/${taskId}/status`, {
          method: 'POST',
          body: { status: 'closed' },
        });
        notify(`Task ${taskId} closed.`, 'success');
      }
    } else {
      return;
    }
    const reopenId = state.selectedTaskId;
    await loadOrders({ showToast: false });
    if (state.clinicianMode && reopenId) {
      openTaskDrawer(reopenId);
    }
  } catch (error) {
    notify(error.message, 'error');
  }
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

elements.form?.addEventListener('submit', handleSubmit);
elements.refreshBtn?.addEventListener('click', () => loadOrders({ showToast: true }));
elements.toggleClinician?.addEventListener('click', () => setClinicianMode(!state.clinicianMode));
elements.drawerClose?.addEventListener('click', () => closeTaskDrawer());
elements.drawerStart?.addEventListener('click', (event) => {
  const taskId = event.target.dataset.taskId;
  updateTaskStatus(taskId, 'start');
});
elements.drawerComplete?.addEventListener('click', (event) => {
  const taskId = event.target.dataset.taskId;
  updateTaskStatus(taskId, 'close');
});
elements.drawerDownload?.addEventListener('click', (event) => {
  const taskId = event.target.dataset.taskId;
  downloadWopdStub(taskId);
});
elements.drawerF2F?.addEventListener('click', (event) => {
  const taskId = event.target.dataset.taskId;
  downloadF2fLetter(taskId);
});
elements.drawerEsign?.addEventListener('click', (event) => {
  const taskId = event.target.dataset.taskId;
  requestEsignEnvelope(taskId);
});
elements.drawerLink?.addEventListener('click', (event) => {
  const taskId = event.target.dataset.taskId;
  createPatientLink(taskId);
});

setClinicianMode(state.clinicianMode);
loadOrders();
setInterval(() => loadOrders(), 30000);
