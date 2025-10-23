const state = {
  apiBase: new URLSearchParams(window.location.search).get('api') || window.localStorage.getItem('gr-api-base') || 'http://localhost:8001',
  submitting: false,
};

const els = {
  form: document.getElementById('intake-form'),
  status: document.getElementById('submit-status'),
  files: document.getElementById('files'),
  resultCard: document.getElementById('result-card'),
  resultTitle: document.getElementById('result-title'),
  resultCopy: document.getElementById('result-copy'),
  resultActions: document.getElementById('result-actions'),
  toastStack: document.getElementById('toast-stack'),
};

if (state.apiBase) {
  try { window.localStorage.setItem('gr-api-base', state.apiBase); } catch (_) {}
}

function api(path) { return `${state.apiBase.replace(/\/$/, '')}${path}`; }

function notify(message) {
  if (!els.toastStack || !message) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  els.toastStack.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 180); }, 3000);
}

function setStatus(text) { if (els.status) els.status.textContent = text; }

async function fileToAttachment(file) {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return { name: file.name, content: b64, content_type: file.type || 'application/octet-stream', metadata: { size: file.size } };
}

async function onSubmit(ev) {
  ev.preventDefault();
  if (state.submitting) return;
  const form = new FormData(els.form);
  const payload = {
    patient: {
      patient_id: form.get('patient_id')?.toString().trim() || undefined,
      first_name: form.get('first_name')?.toString().trim() || undefined,
      last_name: form.get('last_name')?.toString().trim() || undefined,
      dob: form.get('dob')?.toString().trim() || undefined,
      phone: form.get('phone')?.toString().trim() || undefined,
      email: form.get('email')?.toString().trim() || undefined,
      address_line1: form.get('address_line1')?.toString().trim() || undefined,
      address_line2: form.get('address_line2')?.toString().trim() || undefined,
      city: form.get('city')?.toString().trim() || undefined,
      state: form.get('state')?.toString().trim() || undefined,
      postal_code: form.get('postal_code')?.toString().trim() || undefined,
    },
    order: {
      supply_sku: form.get('supply_sku')?.toString().trim() || '',
      quantity: Number(form.get('quantity') || 1),
      requested_date: form.get('requested_date')?.toString().trim() || undefined,
      priority: form.get('priority')?.toString() || 'routine',
      delivery_mode: form.get('delivery_mode')?.toString() || 'auto',
      notes: form.get('notes')?.toString() || undefined,
    },
    attachments: [],
    create_patient_link: true,
    link_expires_minutes: 4320,
    auto_partner: true,
    partner_id: undefined,
    payer_id: form.get('payer_id')?.toString().trim() || undefined,
  };

  if (!payload.order.supply_sku) { notify('Supply SKU is required'); return; }
  if (payload.order.quantity <= 0) { notify('Quantity must be at least 1'); return; }

  try {
    state.submitting = true; setStatus('Submitting…');
    const files = Array.from(els.files?.files || []);
    payload.attachments = await Promise.all(files.map(fileToAttachment));

    const res = await fetch(api('/api/intake'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data?.detail || res.statusText || 'Request failed');
    onSuccess(data);
  } catch (err) {
    notify(err.message || 'Failed to submit intake');
    setStatus('Error');
  } finally {
    state.submitting = false;
  }
}

function onSuccess(data) {
  setStatus('Submitted');
  if (!els.resultCard) return;
  els.resultCard.classList.remove('hidden');
  const orderId = data?.order?.id || '—';
  const status = data?.order?.status || 'pending_review';
  els.resultTitle.textContent = status === 'approved' ? 'You’re all set 🎉' : 'We received your request';
  const partnerLine = data?.partner_order ? ` Sent to partner ${data.partner_order.partner_id}.` : '';
  els.resultCopy.textContent = `Order ${orderId} is ${status}.${partnerLine}`;
  els.resultActions.innerHTML = '';
  if (data?.tracking_url) {
    const a = document.createElement('a');
    a.href = data.tracking_url;
    a.className = 'primary';
    a.textContent = 'Track delivery';
    els.resultActions.appendChild(a);
    notify('Intake complete. Redirecting to tracking…');
    setTimeout(() => { window.location.href = data.tracking_url; }, 1200);
  }
}

els.form?.addEventListener('submit', onSubmit);

