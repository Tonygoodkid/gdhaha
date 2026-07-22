/* ===================================================================
   app.js – Gia Đình HaHa
   All pages share this single script; routing by pathname.
=================================================================== */

// ─── CONFIG ───────────────────────────────────────────────────────
const CREDENTIALS = { username: 'admin', password: 'hoivotri' };
const STORAGE_KEY  = 'ticketVaultData';

// ─── EVENT EMOJIS ────────────────────────────────────────────────
const EVENT_EMOJIS = ['✈️','🏖️','🏔️','🌸','🎡','🗺️','🚂','⛵','🏝️','🎆'];
const TICKET_ICONS = {
  'Vé máy bay':    '✈️',
  'Vé tàu':        '🚂',
  'Vé xe':         '🚌',
  'Vé khách sạn':  '🏨',
  'Vé tham quan':  '🎡',
  'Vé sự kiện':    '🎤',
  'Vé phà/tàu biển':'⛴️',
  'Khác':          '📄',
};

// ─── STORAGE HELPERS ─────────────────────────────────────────────
window.APP_DATA = null;

async function fetchServerData() {
  try {
    const res = await fetch('/api/getData');
    if (res.ok) {
      const serverData = await res.json();
      const localDataStr = localStorage.getItem(STORAGE_KEY);
      const localData = localDataStr ? JSON.parse(localDataStr) : { events: [] };

      // Migration: If server is empty but local has data, upload local to server
      if ((!serverData.events || serverData.events.length === 0) && localData.events && localData.events.length > 0) {
        console.log('Migrating local data to cloud...');
        window.APP_DATA = localData;
        await syncServerData(localData);
      } else {
        window.APP_DATA = serverData;
        // Keep local backup in sync
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
      }
    }
  } catch (e) {
    console.error('Lỗi tải dữ liệu', e);
  }
}

async function syncServerData(data) {
  try {
    await fetch('/api/saveData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.error('Lỗi lưu dữ liệu', e);
  }
}

function loadData() {
  if (!window.APP_DATA) {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { events: [] }; }
    catch { return { events: [] }; }
  }
  return window.APP_DATA;
}
function saveData(data) {
  window.APP_DATA = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); // Giữ backup local
  syncServerData(data);
}

// ─── SPINNER & SYNC HELPERS ──────────────────────────────────────
function showGlobalSpinner(msg = '⏳ Đang đồng bộ dữ liệu...') {
  if (document.getElementById('global-spinner')) return;
  const spinner = document.createElement('div');
  spinner.id = 'global-spinner';
  spinner.innerHTML = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.7);backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;color:var(--primary);text-align:center;padding:20px;">${msg}</div>`;
  document.body.appendChild(spinner);
}
function hideGlobalSpinner() {
  document.getElementById('global-spinner')?.remove();
}

async function handleManualSync() {
  showGlobalSpinner('🚀 Đang làm mới dữ liệu từ máy chủ...');
  await fetchServerData();
  hideGlobalSpinner();
  window.location.reload();
}

// ─── AUTH ─────────────────────────────────────────────────────────
function isLoggedIn() { return sessionStorage.getItem('session') === 'true'; }
function requireAuth() {
  if (!isLoggedIn()) { window.location.href = '/'; }
}
function logout() {
  sessionStorage.removeItem('session');
  window.location.href = '/';
}

// ─── UTILS ────────────────────────────────────────────────────────
function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function formatCurrency(num) {
  if (!num && num !== 0) return '';
  return Number(num).toLocaleString('vi-VN') + ' ₫';
}
function randomEmoji() {
  return EVENT_EMOJIS[Math.floor(Math.random() * EVENT_EMOJIS.length)];
}

function populateUsersFields(ev, checkboxContainerId, selectPayerId) {
  const cbContainer = document.getElementById(checkboxContainerId);
  const selectPayer = document.getElementById(selectPayerId);
  if (!ev) return;
  const members = ev.members || [];
  if (cbContainer) {
    cbContainer.innerHTML = members.map(m => `
      <label class="member-checkbox-label">
        <input type="checkbox" value="${escHtml(m)}" name="${checkboxContainerId}_cb" />
        ${escHtml(m)}
      </label>
    `).join('');
  }
  if (selectPayer) {
    selectPayer.innerHTML = `<option value="">-- Chọn người chi --</option>` + 
      members.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');
  }
}

function getSelectedCheckboxValues(checkboxName) {
  const cbs = document.querySelectorAll(`input[name="${checkboxName}"]:checked`);
  return Array.from(cbs).map(cb => cb.value);
}

// ─── MODAL HELPERS ────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

function initModalCloseButtons() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

// ─── MULTI-FILE INPUT (accumulates files across picks) ─────────────────
// pendingFiles: Map<inputId, Array<{name, data, type}>>
const pendingFiles = {};

function setupMultiFileInput(inputId, previewId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  pendingFiles[inputId] = pendingFiles[inputId] || [];

  input.addEventListener('change', async () => {
    const files = Array.from(input.files);
    for (const file of files) {
      const data = await readFileAsBase64(file);
      pendingFiles[inputId].push({ name: file.name, data, type: file.type });
    }
    input.value = ''; // reset so same file can be re-added
    renderMultiFilePreview(inputId, previewId);
  });

  const zone = input.closest('.file-drop-zone');
  if (zone) {
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', async e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const data = await readFileAsBase64(file);
        pendingFiles[inputId].push({ name: file.name, data, type: file.type });
      }
      renderMultiFilePreview(inputId, previewId);
    });
  }
}

function renderMultiFilePreview(inputId, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  const files = pendingFiles[inputId] || [];
  if (!files.length) { preview.innerHTML = ''; return; }

  preview.innerHTML = files.map((f, i) => {
    const isImg = f.type.startsWith('image/');
    return `
      <div class="mfp-item" data-index="${i}">
        ${isImg
          ? `<img src="${f.data}" alt="${escHtml(f.name)}" class="mfp-thumb" onclick="openPreviewGallery('${inputId}', ${i})" />`
          : `<div class="mfp-pdf" onclick="openPreviewGallery('${inputId}', ${i})">📄</div>`
        }
        <span class="mfp-name">${escHtml(f.name)}</span>
        <button class="mfp-remove" onclick="removePendingFile('${inputId}','${previewId}',${i})" title="Xóa file">✕</button>
      </div>`;
  }).join('');
}

window.removePendingFile = function(inputId, previewId, idx) {
  if (pendingFiles[inputId]) {
    pendingFiles[inputId].splice(idx, 1);
    renderMultiFilePreview(inputId, previewId);
  }
};

function clearPendingFiles(inputId, previewId) {
  pendingFiles[inputId] = [];
  renderMultiFilePreview(inputId, previewId);
}

// ─── FILE INPUT PREVIEW (single, backward compat) ───────────────────────
function setupFilePreview(inputId, previewId) {
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) { preview.classList.add('hidden'); preview.innerHTML = ''; return; }
    preview.classList.remove('hidden');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        preview.innerHTML = `
          <img src="${e.target.result}" alt="preview" />
          <span class="file-preview-name">${file.name}</span>
          <button class="file-preview-remove" onclick="clearFileInput('${inputId}','${previewId}')">✕</button>`;
      };
      reader.readAsDataURL(file);
    } else {
      preview.innerHTML = `
        <span style="font-size:28px">📄</span>
        <span class="file-preview-name">${file.name}</span>
        <button class="file-preview-remove" onclick="clearFileInput('${inputId}','${previewId}')">✕</button>`;
    }
  });

  const zone = input.closest('.file-drop-zone');
  if (zone) {
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop',      e => { e.preventDefault(); zone.classList.remove('drag-over'); input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); });
  }
}

function clearFileInput(inputId, previewId) {
  const input = document.getElementById(inputId);
  if (input) { input.value = ''; input.dispatchEvent(new Event('change')); }
}

// Read file as base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(base64, type) {
  try {
    const parts = base64.split(';base64,');
    const contentType = type || parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.error('Lỗi chuyển đổi base64 to blob', e);
    return null;
  }
}

// ─── GALLERY IMAGE VIEWER ────────────────────────────────────────────────
let _viewerImages = [];  // [{data, type}]
let _viewerIndex  = 0;

window.viewImages = function(images, startIndex) {
  _viewerImages = images.map(img => ({
    data: img.data,
    type: img.type || 'image/jpeg',
    name: img.name || 'file'
  }));
  _viewerIndex = startIndex || 0;
  _showViewerSlide();
  openModal('modalViewImage');
};

// Backward compat: single image
window.viewImage = function(src) {
  viewImages([{ data: src, type: 'image/jpeg' }], 0);
};

window.openPreviewGallery = function(inputId, imgIdx) {
  const files = pendingFiles[inputId] || [];
  viewImages(files, imgIdx);
};

function _showViewerSlide() {
  const img     = document.getElementById('viewerImg');
  const pdf     = document.getElementById('viewerPdf');
  const counter = document.getElementById('viewerCounter');
  const prev    = document.getElementById('viewerPrev');
  const next    = document.getElementById('viewerNext');
  const openBtn = document.getElementById('viewerOpenBtn');

  if (!img || !pdf) return;

  const cur = _viewerImages[_viewerIndex];
  if (!cur) return;

  const isImg = (cur.type || '').startsWith('image/');
  const isPdf = (cur.type || '') === 'application/pdf' || (cur.data || '').startsWith('data:application/pdf');

  if (isImg) {
    img.src = cur.data;
    img.classList.remove('hidden');
    pdf.classList.add('hidden');
    pdf.src = '';
  } else if (isPdf) {
    pdf.src = cur.data;
    pdf.classList.remove('hidden');
    img.classList.add('hidden');
    img.src = '';
  } else {
    img.classList.add('hidden');
    pdf.classList.add('hidden');
  }

  if (openBtn) {
    if (cur.data && cur.data.startsWith('data:')) {
      const blob = base64ToBlob(cur.data, cur.type);
      if (blob) {
        openBtn.href = URL.createObjectURL(blob);
      } else {
        openBtn.href = cur.data;
      }
    } else {
      openBtn.href = cur.data || '#';
    }
    
    if (isPdf) {
      openBtn.setAttribute('download', cur.name || 'file.pdf');
    } else {
      openBtn.removeAttribute('download');
    }
  }

  const total = _viewerImages.length;
  if (counter) counter.textContent = total > 1 ? `${_viewerIndex + 1} / ${total}` : '';
  if (prev) prev.style.display = total > 1 ? 'flex' : 'none';
  if (next) next.style.display = total > 1 ? 'flex' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('viewerPrev')?.addEventListener('click', e => {
    e.stopPropagation();
    _viewerIndex = (_viewerIndex - 1 + _viewerImages.length) % _viewerImages.length;
    _showViewerSlide();
  });
  document.getElementById('viewerNext')?.addEventListener('click', e => {
    e.stopPropagation();
    _viewerIndex = (_viewerIndex + 1) % _viewerImages.length;
    _showViewerSlide();
  });
  // Keyboard nav
  document.addEventListener('keydown', e => {
    const viewer = document.getElementById('modalViewImage');
    if (!viewer || viewer.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft')  { _viewerIndex = (_viewerIndex - 1 + _viewerImages.length) % _viewerImages.length; _showViewerSlide(); }
    if (e.key === 'ArrowRight') { _viewerIndex = (_viewerIndex + 1) % _viewerImages.length; _showViewerSlide(); }
    if (e.key === 'Escape') closeModal('modalViewImage');
  });
});

/* ==================================================================
   app.js – Gia Đình HaHa
================================================================== */
function initLoginPage() {
  // Already logged in → go to dashboard
  if (isLoggedIn()) { window.location.href = '/dashboard.html'; return; }

  const form       = document.getElementById('loginForm');
  const errBox     = document.getElementById('loginError');
  const toggleBtn  = document.getElementById('togglePwd');
  const pwdInput   = document.getElementById('password');

  if (!form) return;

  toggleBtn?.addEventListener('click', () => {
    const isText = pwdInput.type === 'text';
    pwdInput.type = isText ? 'password' : 'text';
    toggleBtn.textContent = isText ? '👁️' : '🙈';
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = pwdInput.value;

    if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
      sessionStorage.setItem('session', 'true');
      window.location.href = '/dashboard.html';
    } else {
      errBox.classList.remove('hidden');
      form.querySelector('input').focus();
      setTimeout(() => errBox.classList.add('hidden'), 3500);
    }
  });
}

/* ==================================================================
   PAGE: DASHBOARD (dashboard.html)
================================================================== */
function initDashboardPage() {
  requireAuth();

  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('syncBtn')?.addEventListener('click', handleManualSync);

  const grid       = document.getElementById('eventGrid');
  const emptyState = document.getElementById('emptyState');
  const fabCreate  = document.getElementById('fabCreate');
  const formCreate = document.getElementById('formCreateEvent');
  const memberInput= document.getElementById('memberInput');
  const addMember  = document.getElementById('addMemberBtn');
  const memberTags = document.getElementById('memberTags');

  let pendingMembers = [];
  let pendingDeleteId = null;

  initModalCloseButtons();

  // Open create modal
  fabCreate?.addEventListener('click', () => {
    pendingMembers = [];
    renderMemberTags();
    formCreate?.reset();
    openModal('modalCreateEvent');
    document.getElementById('eventName')?.focus();
  });

  // Member input
  function addMemberFromInput() {
    const val = memberInput.value.trim();
    if (!val) return;
    pendingMembers.push(val);
    memberInput.value = '';
    memberInput.focus();
    renderMemberTags();
  }

  addMember?.addEventListener('click', addMemberFromInput);
  memberInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addMemberFromInput(); }
  });

  function renderMemberTags() {
    if (!memberTags) return;
    memberTags.innerHTML = pendingMembers.map((m, i) => `
      <span class="member-chip">
        👤 ${escHtml(m)}
        <button class="chip-remove" onclick="removePendingMember(${i})" aria-label="Xoá ${escHtml(m)}">✕</button>
      </span>`).join('');
  }
  window.removePendingMember = function(i) {
    pendingMembers.splice(i, 1);
    renderMemberTags();
  };

  // Create event submit
  formCreate?.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('eventName').value.trim();
    const date = document.getElementById('eventDate').value;
    if (!name) return;

    const data = loadData();
    data.events.push({
      id:      uuid(),
      emoji:   randomEmoji(),
      name,
      date,
      members: [...pendingMembers],
      tickets:  [],
      invoices: [],
      createdAt: new Date().toISOString(),
    });
    saveData(data);
    closeModal('modalCreateEvent');
    renderEvents();
  });

  // Delete event
  document.getElementById('confirmDeleteEvent')?.addEventListener('click', () => {
    if (!pendingDeleteId) return;
    const data = loadData();
    data.events = data.events.filter(e => e.id !== pendingDeleteId);
    saveData(data);
    pendingDeleteId = null;
    closeModal('modalDeleteEvent');
    renderEvents();
  });

  window.openDeleteEvent = function(id) {
    pendingDeleteId = id;
    openModal('modalDeleteEvent');
  };

  // Render
  function renderEvents() {
    const data = loadData();
    const events = data.events.slice().reverse();
    grid.innerHTML = '';

    if (events.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    events.forEach(ev => {
      const totalAmount = ev.tickets.reduce((sum, t) => sum + Number(t.amount || 0), 0) 
                        + ev.invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="event-card-emoji">${ev.emoji || '✈️'}</div>
        <div class="event-card-name">${escHtml(ev.name)}</div>
        <div class="event-card-date">${ev.date ? '📅 ' + formatDate(ev.date) : '📅 Chưa xác định ngày'}</div>
        <div class="event-card-meta">
          <span class="badge badge-blue">🎫 ${ev.tickets.length} vé</span>
          <span class="badge badge-green">🧾 ${ev.invoices.length} hoá đơn</span>
          ${ev.members.length ? `<span class="badge badge-blue">👥 ${ev.members.length} người</span>` : ''}
          ${totalAmount > 0 ? `<span class="badge badge-green">💰 ${formatCurrency(totalAmount)}</span>` : ''}
        </div>
        ${ev.members.length ? `<div class="member-chips">${ev.members.map(m=>`<span class="member-chip">👤 ${escHtml(m)}</span>`).join('')}</div>` : ''}
        <div class="event-card-actions">
          <button class="btn-icon qab-ticket-sm" title="Thêm vé" onclick="event.stopPropagation(); openQuickTicket('${ev.id}')">🎫</button>
          <button class="btn-icon qab-invoice-sm" title="Thêm hoá đơn" onclick="event.stopPropagation(); openQuickInvoice('${ev.id}')">🧾</button>
          <button class="btn-icon" title="Xoá" onclick="event.stopPropagation(); openDeleteEvent('${ev.id}')">🗑️</button>
        </div>`;
      card.addEventListener('click', () => { window.location.href = `/event.html?id=${ev.id}`; });
      grid.appendChild(card);
    });
  }

  // ── Quick-add: Vé nhanh từ dashboard ──
  setupMultiFileInput('qtTicketFile', 'qtTicketFilePreview');
  setupMultiFileInput('qiFile',       'qiFilePreview');

  window.openQuickTicket = function(eventId) {
    document.getElementById('formQuickTicket')?.reset();
    clearPendingFiles('qtTicketFile', 'qtTicketFilePreview');
    document.getElementById('qtTargetEventId').value = eventId;
    const data = loadData();
    const ev = data.events.find(x => x.id === eventId);
    populateUsersFields(ev, 'qtTicketUsers', 'qtTicketPayer');
    openModal('modalQuickTicket');
    document.getElementById('qtTicketName')?.focus();
  };

  window.openQuickInvoice = function(eventId) {
    document.getElementById('formQuickInvoice')?.reset();
    clearPendingFiles('qiFile', 'qiFilePreview');
    document.getElementById('qiTargetEventId').value = eventId;
    const data = loadData();
    const ev = data.events.find(x => x.id === eventId);
    populateUsersFields(ev, 'qiUsers', 'qiPayer');
    openModal('modalQuickInvoice');
    document.getElementById('qiTitle')?.focus();
  };

  document.getElementById('formQuickTicket')?.addEventListener('submit', async e => {
    e.preventDefault();
    const evId = document.getElementById('qtTargetEventId').value;
    const data  = loadData();
    const ev    = data.events.find(x => x.id === evId);
    if (!ev) return;
    const files = pendingFiles['qtTicketFile'] || [];
    const images = files.map(f => ({ data: f.data, type: f.type, name: f.name }));
    ev.tickets.push({
      type:    document.getElementById('qtTicketType').value,
      name:    document.getElementById('qtTicketName').value.trim(),
      code:    document.getElementById('qtTicketCode').value.trim(),
      date:    document.getElementById('qtTicketDate').value,
      amount:  document.getElementById('qtTicketAmount').value,
      users:   getSelectedCheckboxValues('qtTicketUsers_cb'),
      payer:   document.getElementById('qtTicketPayer').value,
      note:    document.getElementById('qtTicketNote').value.trim(),
      images,
      image: null,
      addedAt: new Date().toISOString(),
    });
    saveData(data);
    clearPendingFiles('qtTicketFile', 'qtTicketFilePreview');
    closeModal('modalQuickTicket');
    renderEvents();
  });

  document.getElementById('formQuickInvoice')?.addEventListener('submit', async e => {
    e.preventDefault();
    const evId = document.getElementById('qiTargetEventId').value;
    const data  = loadData();
    const ev    = data.events.find(x => x.id === evId);
    if (!ev) return;
    const files = pendingFiles['qiFile'] || [];
    const images = files.map(f => ({ data: f.data, type: f.type, name: f.name }));
    ev.invoices.push({
      title:   document.getElementById('qiTitle').value.trim(),
      amount:  document.getElementById('qiAmount').value,
      users:   getSelectedCheckboxValues('qiUsers_cb'),
      payer:   document.getElementById('qiPayer').value,
      note:    document.getElementById('qiNote').value.trim(),
      images,
      image: null,
      addedAt: new Date().toISOString(),
    });
    saveData(data);
    clearPendingFiles('qiFile', 'qiFilePreview');
    closeModal('modalQuickInvoice');
    renderEvents();
  });

  renderEvents();
}

/* ==================================================================
   PAGE: EVENT DETAIL (event.html)
================================================================== */
function initEventPage() {
  requireAuth();

  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('syncBtn')?.addEventListener('click', handleManualSync);

  const params  = new URLSearchParams(window.location.search);
  const eventId = params.get('id');
  if (!eventId) { window.location.href = '/dashboard.html'; return; }

  initModalCloseButtons();
  setupMultiFileInput('invoiceFile', 'invoiceFilePreview');

  let pendingDeleteType = null; // 'ticket' | 'invoice'
  let pendingDeleteIdx  = null;

  // ── Load event ──
  function getEvent() {
    const data = loadData();
    return data.events.find(e => e.id === eventId);
  }
  function saveEvent(ev) {
    const data = loadData();
    const idx  = data.events.findIndex(e => e.id === eventId);
    if (idx > -1) { data.events[idx] = ev; saveData(data); }
  }

  // ── Render header ──
  function renderEventInfo() {
    const ev = getEvent();
    if (!ev) { window.location.href = '/dashboard.html'; return; }
    document.title = `${ev.name} – Gia Đình HaHa`;
    document.getElementById('eventPageTitle').textContent = ev.name;
    document.getElementById('infoName').textContent = ev.name;
    document.getElementById('infoDate').textContent = ev.date ? '📅 ' + formatDate(ev.date) : '';
    document.getElementById('infoMembers').innerHTML = ev.members.map(m =>
      `<span class="member-chip">👤 ${escHtml(m)}</span>`).join('');
  }

  // ── Tabs ──
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById('panel' + capitalise(btn.dataset.tab))?.classList.remove('hidden');
    });
  });

  // ── Render tickets ──
  function getTicketImages(t) {
    // Support new `images` array and old single `image` field
    if (t.images && t.images.length) return t.images;
    if (t.image) return [{ data: t.image, type: 'image/jpeg', name: 'file' }];
    return [];
  }

  window.openTicketGallery = function(ticketIdx, imgIdx) {
    const ev = getEvent();
    if (!ev) return;
    const t = ev.tickets[ticketIdx];
    const imgs = getTicketImages(t);
    viewImages(imgs, imgIdx);
  };

  function getInvoiceImages(inv) {
    if (inv.images && inv.images.length) return inv.images;
    if (inv.image) return [{ data: inv.image, type: 'image/jpeg', name: 'file' }];
    return [];
  }

  window.openInvoiceGallery = function(invoiceIdx, imgIdx) {
    const ev = getEvent();
    if (!ev) return;
    const inv = ev.invoices[invoiceIdx];
    const imgs = getInvoiceImages(inv);
    viewImages(imgs, imgIdx || 0);
  };

  function renderTickets() {
    const ev   = getEvent();
    const list = document.getElementById('ticketList');
    const empty= document.getElementById('emptyTickets');
    if (!ev) return;

    list.innerHTML = '';
    if (!ev.tickets.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    ev.tickets.forEach((t, i) => {
      const imgs = getTicketImages(t);

      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-icon">${TICKET_ICONS[t.type] || '📄'}</div>
        <div class="item-body">
          <div class="item-type">${escHtml(t.type)}</div>
          <div class="item-name">${escHtml(t.name)}</div>
          <div class="item-meta">
            ${t.code      ? `<span>🔑 ${escHtml(t.code)}</span>`           : ''}
            ${t.date      ? `<span>📅 ${formatDateTime(t.date)}</span>`    : ''}
            ${t.amount    ? `<span>💰 ${formatCurrency(t.amount)}</span>`  : ''}
            ${t.users && t.users.length ? `<span>👥 ${escHtml(t.users.join(', '))}</span>` : ''}
            ${t.payer     ? `<span>💳 ${escHtml(t.payer)}</span>`          : ''}
          </div>
          ${t.note ? `<div class="item-note">💬 ${escHtml(t.note)}</div>` : ''}
          ${imgs.length ? `
            <div class="ticket-img-gallery">
              ${imgs.map((img, gi) => {
                const isImg = (img.type || '').startsWith('image/');
                return isImg
                  ? `<img src="${img.data}" class="gallery-thumb" alt="file ${gi+1}" onclick="openTicketGallery(${i}, ${gi})" />`
                  : `<div class="gallery-thumb gallery-pdf" onclick="openTicketGallery(${i}, ${gi})">📄<span>${escHtml(img.name||'PDF')}</span></div>`;
              }).join('')}
              <span class="gallery-count">${imgs.length} file</span>
            </div>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn-icon" title="Xoá" onclick="askDeleteItem('ticket',${i})">🗑️</button>
        </div>`;
      list.appendChild(card);
    });
  }

  // ── Render invoices ──
  function renderInvoices() {
    const ev   = getEvent();
    const list = document.getElementById('invoiceList');
    const empty= document.getElementById('emptyInvoices');
    if (!ev) return;

    list.innerHTML = '';
    if (!ev.invoices.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    ev.invoices.forEach((inv, i) => {
      const imgs = getInvoiceImages(inv);

      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-icon">🧾</div>
        <div class="item-body">
          <div class="item-name">${escHtml(inv.title)}</div>
          <div class="item-meta">
            ${inv.amount ? `<span>💰 ${formatCurrency(inv.amount)}</span>` : ''}
            ${inv.users && inv.users.length ? `<span>👥 ${escHtml(inv.users.join(', '))}</span>` : ''}
            ${inv.payer ? `<span>💳 ${escHtml(inv.payer)}</span>` : ''}
          </div>
          ${inv.note   ? `<div class="item-note">📝 ${escHtml(inv.note)}</div>` : ''}
          ${imgs.length ? `
            <div class="ticket-img-gallery">
              ${imgs.map((img, gi) => {
                const isImg = (img.type || '').startsWith('image/');
                return isImg
                  ? `<img src="${img.data}" class="gallery-thumb" alt="file ${gi+1}" onclick="openInvoiceGallery(${i}, ${gi})" />`
                  : `<div class="gallery-thumb gallery-pdf" onclick="openInvoiceGallery(${i}, ${gi})">📄<span>${escHtml(img.name||'PDF')}</span></div>`;
              }).join('')}
              <span class="gallery-count">${imgs.length} file</span>
            </div>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn-icon" title="Xoá" onclick="askDeleteItem('invoice',${i})">🗑️</button>
        </div>`;
      list.appendChild(card);
    });
  }

  // ── Render Schedule ──
  function renderSchedule() {
    const ev = getEvent();
    const display = document.getElementById('scheduleDisplay');
    if (!ev || !display) return;

    if (!ev.schedule || !ev.schedule.trim()) {
      display.innerHTML = `
        <div class="empty-state-sm">
          <span>🗓️</span> Chưa có lịch trình. Nhấn <button style="padding:0; border:none; background:none; font-weight:bold; cursor:pointer; color:var(--primary); text-decoration:underline; font-size:inherit;" onclick="openEditSchedule()">Chỉnh sửa</button> để paste lịch trình vào nhé!
        </div>
      `;
      return;
    }

    // Convert newlines to <br> and wrap bold dates/titles
    let html = escHtml(ev.schedule).replace(/\n/g, '<br>');
    // Auto-bold lines that look like headers (Day X, etc)
    html = html.replace(/^(<b>)?(Ngày \d+|Day \d+|Lịch trình|Sáng|Trưa|Chiều|Tối).*$/gim, '<b>$&</b>');
    display.innerHTML = html;
  }

  // ── Schedule Events ──
  function openEditSchedule() {
    const ev = getEvent();
    if (!ev) return;
    document.getElementById('scheduleInput').value = ev.schedule || '';
    openModal('modalEditSchedule');
    document.getElementById('scheduleInput').focus();
  }
  window.openEditSchedule = openEditSchedule;

  document.getElementById('editScheduleBtn')?.addEventListener('click', openEditSchedule);
  document.getElementById('fabEditSchedule')?.addEventListener('click', openEditSchedule);

  document.getElementById('formEditSchedule')?.addEventListener('submit', e => {
    e.preventDefault();
    const ev = getEvent();
    if (!ev) return;
    ev.schedule = document.getElementById('scheduleInput').value;
    saveEvent(ev);
    closeModal('modalEditSchedule');
    renderSchedule();
  });

  // ── Add ticket ──
  // Setup multi-file input for ticket
  setupMultiFileInput('ticketFile', 'ticketFilePreview');

  document.getElementById('addTicketBtn')?.addEventListener('click', () => {
    document.getElementById('formAddTicket')?.reset();
    clearPendingFiles('ticketFile', 'ticketFilePreview');
    const ev = getEvent();
    populateUsersFields(ev, 'ticketUsers', 'ticketPayer');
    openModal('modalAddTicket');
    document.getElementById('ticketName')?.focus();
  });

  document.getElementById('formAddTicket')?.addEventListener('submit', async e => {
    e.preventDefault();
    const ev = getEvent();
    if (!ev) return;

    // Collect all pending files
    const files = pendingFiles['ticketFile'] || [];
    const images = files.map(f => ({ data: f.data, type: f.type, name: f.name }));

    ev.tickets.push({
      type:      document.getElementById('ticketType').value,
      name:      document.getElementById('ticketName').value.trim(),
      code:      document.getElementById('ticketCode').value.trim(),
      date:      document.getElementById('ticketDate').value,
      amount:    document.getElementById('ticketAmount').value,
      users:     getSelectedCheckboxValues('ticketUsers_cb'),
      payer:     document.getElementById('ticketPayer').value,
      note:      document.getElementById('ticketNote').value.trim(),
      images,           // array of {data, type, name}
      image: null,      // deprecated, kept for compat
      addedAt:   new Date().toISOString(),
    });
    saveEvent(ev);
    clearPendingFiles('ticketFile', 'ticketFilePreview');
    closeModal('modalAddTicket');
    renderTickets();
  });

  // ── Add invoice ──
  document.getElementById('addInvoiceBtn')?.addEventListener('click', () => {
    document.getElementById('formAddInvoice')?.reset();
    clearPendingFiles('invoiceFile', 'invoiceFilePreview');
    const ev = getEvent();
    populateUsersFields(ev, 'invoiceUsers', 'invoicePayer');
    openModal('modalAddInvoice');
    document.getElementById('invoiceTitle')?.focus();
  });

  document.getElementById('formAddInvoice')?.addEventListener('submit', async e => {
    e.preventDefault();
    const ev = getEvent();
    if (!ev) return;

    const files = pendingFiles['invoiceFile'] || [];
    const images = files.map(f => ({ data: f.data, type: f.type, name: f.name }));

    ev.invoices.push({
      title:   document.getElementById('invoiceTitle').value.trim(),
      amount:  document.getElementById('invoiceAmount').value,
      users:   getSelectedCheckboxValues('invoiceUsers_cb'),
      payer:   document.getElementById('invoicePayer').value,
      note:    document.getElementById('invoiceNote').value.trim(),
      images,
      image: null,
      addedAt: new Date().toISOString(),
    });
    saveEvent(ev);
    clearPendingFiles('invoiceFile', 'invoiceFilePreview');
    closeModal('modalAddInvoice');
    renderInvoices();
  });

  // ── Delete item ──
  window.askDeleteItem = function(type, idx) {
    pendingDeleteType = type;
    pendingDeleteIdx  = idx;
    openModal('modalDeleteItem');
  };

  document.getElementById('confirmDeleteItem')?.addEventListener('click', () => {
    const ev = getEvent();
    if (!ev) return;
    if (pendingDeleteType === 'ticket')  ev.tickets.splice(pendingDeleteIdx, 1);
    if (pendingDeleteType === 'invoice') ev.invoices.splice(pendingDeleteIdx, 1);
    saveEvent(ev);
    closeModal('modalDeleteItem');
    renderTickets();
    renderInvoices();
    pendingDeleteType = null;
    pendingDeleteIdx  = null;
  });

  // ── Image viewer ──
  window.viewImage = function(src) {
    document.getElementById('viewerImg').src = src;
    openModal('modalViewImage');
  };

  // ── Init ──
  renderEventInfo();
  renderTickets();
  renderInvoices();
  renderSchedule();
}

// ─── ESCAPE HTML ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── ROUTER ──────────────────────────────────────────────────────
(async function route() {
  if (isLoggedIn()) {
    showGlobalSpinner();
    await fetchServerData();
    hideGlobalSpinner();
  }

  const path = window.location.pathname;
  if (path === '/' || path.endsWith('index.html'))      initLoginPage();
  else if (path.endsWith('dashboard.html'))             initDashboardPage();
  else if (path.endsWith('event.html'))                 initEventPage();
})();

// ─── PWA SERVICE WORKER REGISTRATION ─────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered!', reg);
    }).catch(err => console.log('SW registration failed', err));
  });
}

