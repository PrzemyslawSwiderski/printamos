(function () {
  const form = document.getElementById('printForm');
  const addOptionBtn = document.getElementById('addOptionBtn');
  const optionName = document.getElementById('optionName');
  const optionValue = document.getElementById('optionValue');
  const optionsList = document.getElementById('optionsList');
  const statusMessage = document.getElementById('statusMessage');
  const submitBtn = document.getElementById('submitBtn');
  const submitSpinner = document.getElementById('submitSpinner');
  const submitText = document.getElementById('submitText');
  const statusBadge = document.getElementById('statusBadge');
  const resetBtn = document.getElementById('resetBtn');
  const printerSelect = document.getElementById('printerSelect');
  let options = [
    'media=iso_a4_210x297mm',
    'print-quality=3',
    'sides=one-sided'
  ];

  function renderOptions() {
    optionsList.innerHTML = '';
    options.forEach((opt, idx) => {
      const badge = document.createElement('div');
      badge.className = 'badge bg-secondary d-inline-flex align-items-center gap-2 p-2';
      badge.setAttribute('data-idx', idx);

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
    if (option.length > 256) {
      alert('Option too long (max 256 characters).');
      return;
    }
    options.push(option);
    optionName.value = '';
    optionValue.value = '';
    optionName.focus();
    renderOptions();
  });

  [optionName, optionValue].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addOptionBtn.click();
      }
    });
  });

  resetBtn.addEventListener('click', () => {
    form.reset();
    options = [];
    renderOptions();
    statusMessage.textContent = 'Idle';
    statusBadge.innerHTML = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusBadge.innerHTML = '';

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      statusMessage.textContent = 'Fix validation errors above.';
      return;
    }

    const selectedPrinter = printerSelect.value;
    if (!selectedPrinter) {
      return;
    }

    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      statusMessage.textContent = 'Please choose a file to upload.';
      return;
    }

    const formData = new FormData();
    formData.append('printer_name', selectedPrinter);
    formData.append('file', file);
    formData.append('copies', document.getElementById('copies').value || '1');
    options.forEach(opt => formData.append('options', opt));

    submitSpinner.classList.remove('visually-hidden');
    submitText.textContent = ' Sending...';
    submitBtn.disabled = true;
    statusMessage.textContent = 'Sending print job...';

    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 30000); // 30s timeout

      const resp = await fetch('/api/v1/print-job', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      const text = await resp.text().catch(() => '');
      if (resp.ok) {
        statusBadge.innerHTML = '<span class="badge bg-success">Success</span>';
        statusMessage.textContent = text || 'Print job sent successfully.';
      } else if (resp.status === 400) {
        statusBadge.innerHTML = '<span class="badge bg-warning text-dark">Bad Request</span>';
        statusMessage.textContent = text || 'Invalid input (400).';
      } else {
        statusBadge.innerHTML = '<span class="badge bg-danger">Error</span>';
        statusMessage.textContent = text || `Server error (${resp.status}).`;
      }
    } catch (err) {
      statusBadge.innerHTML = '<span class="badge bg-danger">Network</span>';
      statusMessage.textContent = 'Network or connection error: ' + (err?.message || String(err));
    } finally {
      submitSpinner.classList.add('visually-hidden');
      submitText.textContent = 'Send to Printer';
      submitBtn.disabled = false;
    }
  });

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    // Render default options
    renderOptions();
  });

  // Drag-and-drop support
  (function addDragDrop() {
    const fileEl = document.getElementById('fileInput');

    ['dragenter', 'dragover'].forEach(evt => {
      fileEl.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileEl.classList.add('border-success');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      fileEl.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileEl.classList.remove('border-success');
      });
    });
    fileEl.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt?.files?.length) {
        fileEl.files = dt.files;
      }
    });
  })();
})();
