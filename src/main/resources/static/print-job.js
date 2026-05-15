(function () {
  const form = document.getElementById('printForm');
  const addOptionBtn = document.getElementById('addOptionBtn');
  const optionName = document.getElementById('optionName');
  const optionValue = document.getElementById('optionValue');
  const optionsList = document.getElementById('optionsList');
  const statusMessage = document.getElementById('statusMessage');
  const fileStatusList = document.getElementById('fileStatusList');
  const submitBtn = document.getElementById('submitBtn');
  const submitSpinner = document.getElementById('submitSpinner');
  const submitText = document.getElementById('submitText');
  const resetBtn = document.getElementById('resetBtn');
  const printerSelect = document.getElementById('printerSelect');

  let options = [
    'media=iso_a4_210x297mm',
    'print-quality=3',
    'sides=one-sided',
    'print-color-mode=monochrome'
  ];

  // ── Options badges ────────────────────────────────────────────────────────

  function renderOptions() {
    optionsList.innerHTML = '';
    options.forEach((opt, idx) => {
      const badge = document.createElement('div');
      badge.className = 'badge bg-secondary d-inline-flex align-items-center gap-2 p-2';

      const span = document.createElement('span');
      span.textContent = opt;
      span.className = 'me-2';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-close btn-close-white btn-sm';
      removeBtn.setAttribute('aria-label', 'Remove option');
      removeBtn.addEventListener('click', () => {
        options.splice(idx, 1);
        renderOptions();
      });

      badge.appendChild(span);
      badge.appendChild(removeBtn);
      optionsList.appendChild(badge);
    });
  }

  addOptionBtn.addEventListener('click', () => {
    const name = optionName.value.trim();
    const value = optionValue.value.trim();
    if (!name || !value) return;
    const option = `${name}=${value}`;
    if (option.length > 256) { alert('Option too long (max 256 characters).'); return; }
    options.push(option);
    optionName.value = '';
    optionValue.value = '';
    optionName.focus();
    renderOptions();
  });

  [optionName, optionValue].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addOptionBtn.click(); }
    });
  });

  resetBtn.addEventListener('click', () => {
    form.reset();
    options = [];
    renderOptions();
    statusMessage.textContent = 'Idle';
    fileStatusList.innerHTML = '';
  });

  // ── Per-file status rows ──────────────────────────────────────────────────

  function createFileRow(fileName) {
    const row = document.createElement('div');
    row.className = 'file-status-row';

    const name = document.createElement('span');
    name.className = 'file-status-name';
    name.textContent = fileName;
    name.title = fileName;

    const badge = document.createElement('span');
    badge.className = 'badge bg-secondary';
    badge.textContent = 'Pending';

    row.appendChild(name);
    row.appendChild(badge);
    fileStatusList.appendChild(row);

    return {
      setPending() { badge.className = 'badge bg-secondary'; badge.textContent = 'Pending'; },
      setSending() { badge.className = 'badge bg-primary'; badge.textContent = 'Sending…'; },
      setOk(msg) { badge.className = 'badge bg-success'; badge.textContent = msg || 'Sent'; },
      setError(msg) { badge.className = 'badge bg-danger'; badge.textContent = msg || 'Error'; badge.title = msg; },
      setWarn(msg) { badge.className = 'badge bg-warning text-dark'; badge.textContent = msg || 'Bad request'; badge.title = msg; },
    };
  }

  // ── Single-file print job ─────────────────────────────────────────────────

  async function printFile(file, printer, copies, row) {
    row.setSending();

    const formData = new FormData();
    formData.append('printer_name', printer);
    formData.append('file', file);
    formData.append('copies', copies);
    options.forEach(opt => formData.append('options', opt));

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const resp = await fetch('/api/v1/print-job', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timer);

      const text = await resp.text().catch(() => '');

      if (resp.ok) {
        row.setOk('Sent');
      } else if (resp.status === 400) {
        row.setWarn(text || 'Bad request');
      } else {
        row.setError(text || `Error ${resp.status}`);
      }
    } catch (err) {
      row.setError(err?.name === 'AbortError' ? 'Timeout' : 'Network error');
    }
  }

  // ── Form submit ───────────────────────────────────────────────────────────

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fileStatusList.innerHTML = '';

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      statusMessage.textContent = 'Fix validation errors above.';
      return;
    }

    const printer = printerSelect.value;
    if (!printer) return;

    const fileInput = document.getElementById('fileInput');
    const files = Array.from(fileInput.files || []);
    if (!files.length) {
      statusMessage.textContent = 'Please choose at least one file.';
      return;
    }

    const copies = document.getElementById('copies').value || '1';

    // Build all status rows up-front so the user sees the full queue
    const rows = files.map(f => createFileRow(f.name));

    submitSpinner.classList.remove('visually-hidden');
    submitBtn.disabled = true;

    // Send jobs sequentially
    for (let i = 0; i < files.length; i++) {
      statusMessage.textContent = `Printing file ${i + 1} of ${files.length}: ${files[i].name}`;
      submitText.textContent = ` ${i + 1}/${files.length}`;
      await printFile(files[i], printer, copies, rows[i]);
    }

    const sent = rows.filter((_, i) => /* check badge colour via DOM */ fileStatusList.children[i]?.querySelector('.bg-success')).length;
    const failed = files.length - sent;
    statusMessage.textContent = failed === 0
      ? `All ${files.length} file(s) sent successfully.`
      : `Done — ${sent} sent, ${failed} failed.`;

    submitSpinner.classList.add('visually-hidden');
    submitText.textContent = 'Send to Printer';
    submitBtn.disabled = false;
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', renderOptions);

  // Drag-and-drop support
  (function addDragDrop() {
    const fileEl = document.getElementById('fileInput');
    ['dragenter', 'dragover'].forEach(evt => {
      fileEl.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        fileEl.classList.add('border-success');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      fileEl.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation();
        fileEl.classList.remove('border-success');
      });
    });
    fileEl.addEventListener('drop', (e) => {
      if (e.dataTransfer?.files?.length) fileEl.files = e.dataTransfer.files;
    });
  })();
})();
