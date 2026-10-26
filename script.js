/**
 * PrintQueue Simulator — Interactive FIFO Printer Management & Learning Game
 * Frontend Client Engine
 * 
 * Supports dual-mode:
 * 1. Native C++ HTTP Backend Mode (communicates directly with C++ REST server on localhost:8080)
 * 2. Standalone Simulation Mode (in-browser mirror if backend server is not yet running)
 */

// =============================================================================
// GLOBAL STATE & DATA STRUCTURES
// =============================================================================

const CONFIG = {
  apiBase: window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:8080',
  pollIntervalMs: 1500,
  pagePrintSpeedMs: 900 // Simulation speed: 0.9s per page
};

const State = {
  isBackendConnected: false,
  printerStatus: 'IDLE', // 'IDLE' | 'PRINTING' | 'PAUSED'
  currentJob: null,
  currentPrintingPage: 0,
  queue: [], // Array of waiting jobs (index 0 is front, last is rear)
  completedJobs: [],
  logs: [],
  autoPrintEnabled: false,
  printTimer: null,
  stats: {
    totalSubmitted: 0,
    totalCompleted: 0,
    totalPagesPrinted: 0,
    jobSequence: 101
  }
};

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupFormValidation();
  setupPrinterControls();
  setupQueueLab();
  setupGameEngine();
  setupModals();

  // Test connection to C++ backend
  checkBackendConnection();

  // Polling loop to sync with C++ backend if connected
  setInterval(() => {
    if (State.isBackendConnected) {
      syncWithBackend();
    }
  }, CONFIG.pollIntervalMs);
});

// =============================================================================
// BACKEND API COMMUNICATION & SYNC
// =============================================================================

async function checkBackendConnection() {
  const pill = document.getElementById('backendStatusPill');
  const text = document.getElementById('backendStatusText');
  const banner = document.getElementById('connectionBanner');
  const bannerMsg = document.getElementById('bannerMessage');
  const bannerAction = document.getElementById('bannerActionBtn');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${CONFIG.apiBase}/api/status`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      State.isBackendConnected = true;

      pill.className = 'status-pill status-connected';
      text.textContent = 'C++ Backend Connected (Port 8080)';
      banner.style.display = 'flex';
      bannerMsg.innerHTML = '<strong>Connected to Native C++ HTTP Server!</strong> All enqueue, dequeue, and peek operations are processed by genuine C++ queue logic.';
      bannerAction.style.display = 'none';

      applyStatusUpdate(data);
      loadBackendQueue();
      loadBackendHistory();
      return;
    }
  } catch (err) {
    // Backend offline or running standalone
  }

  // Fallback to local mode
  State.isBackendConnected = false;
  pill.className = 'status-pill status-fallback';
  text.textContent = 'Local Engine (C++ Offline)';
  banner.style.display = 'flex';
  bannerMsg.innerHTML = '<strong>Running in Standalone Demonstration Mode.</strong> To connect the native C++ HTTP server, run <code>make run</code> or <code>./printqueue_server</code> in your terminal.';
  bannerAction.style.display = 'inline-block';
  bannerAction.onclick = () => {
    document.getElementById('docsModal').style.display = 'flex';
  };

  updateUI();
}

async function syncWithBackend() {
  try {
    const res = await fetch(`${CONFIG.apiBase}/api/status`);
    if (res.ok) {
      const data = await res.json();
      applyStatusUpdate(data);
    }
  } catch (e) {
    console.warn('Backend sync lost, retrying...');
  }
}

function applyStatusUpdate(data) {
  State.stats.totalSubmitted = data.totalSubmitted;
  State.stats.totalCompleted = data.totalCompleted;
  State.stats.totalPagesPrinted = data.totalPagesPrinted;
  
  if (data.currentJob) {
    State.currentJob = data.currentJob;
    State.printerStatus = data.printerStatus;
    State.currentPrintingPage = data.currentPrintingPage;
  } else if (State.printerStatus !== 'PAUSED') {
    if (!State.currentJob) {
      State.printerStatus = 'IDLE';
    }
  }

  updateMetricsDisplay(data.estimatedWaitTimeSec);
}

async function loadBackendQueue() {
  try {
    const res = await fetch(`${CONFIG.apiBase}/api/queue`);
    if (res.ok) {
      const data = await res.json();
      State.queue = data.queue || [];
      renderQueueCards();
    }
  } catch (e) {
    console.error('Failed to load queue:', e);
  }
}

async function loadBackendHistory() {
  try {
    const res = await fetch(`${CONFIG.apiBase}/api/history`);
    if (res.ok) {
      const data = await res.json();
      State.completedJobs = data.completed || [];
      renderCompletedTable();

      if (data.logs && data.logs.length > 0) {
        data.logs.forEach(l => {
          addLogEntry(l.time, l.operation, l.details, false);
        });
      }
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

// =============================================================================
// NAVIGATION & TABS
// =============================================================================

function setupNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');

      // Refresh lab or game views on tab switch
      if (targetId === 'tab-lab') updateLabInspector();
    });
  });

  // Header quick buttons
  document.getElementById('btnQuickDemo').addEventListener('click', loadDemoScenario);
  document.getElementById('btnOpenDocs').addEventListener('click', () => {
    document.getElementById('docsModal').style.display = 'flex';
  });

  document.getElementById('backendStatusPill').addEventListener('click', checkBackendConnection);
}

// =============================================================================
// FORM VALIDATION & SUBMISSION
// =============================================================================

function setupFormValidation() {
  const form = document.getElementById('printJobForm');
  const studentInput = document.getElementById('studentName');
  const docInput = document.getElementById('documentName');
  const pagesInput = document.getElementById('pageCount');
  const typeSelect = document.getElementById('docType');

  // Quick template chips
  document.querySelectorAll('.quick-templates .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      studentInput.value = chip.getAttribute('data-name');
      docInput.value = chip.getAttribute('data-doc');
      pagesInput.value = chip.getAttribute('data-pages');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valid = true;
    const student = studentInput.value.trim();
    const doc = docInput.value.trim();
    const pages = parseInt(pagesInput.value, 10);
    const type = typeSelect.value;

    const studentErr = document.getElementById('studentNameError');
    const docErr = document.getElementById('documentNameError');
    const pageErr = document.getElementById('pageCountError');

    if (!student) {
      studentErr.classList.add('visible');
      valid = false;
    } else {
      studentErr.classList.remove('visible');
    }

    if (!doc) {
      docErr.classList.add('visible');
      valid = false;
    } else {
      docErr.classList.remove('visible');
    }

    if (isNaN(pages) || pages < 1) {
      pageErr.classList.add('visible');
      valid = false;
    } else {
      pageErr.classList.remove('visible');
    }

    if (!valid) return;

    // Enqueue operation
    await enqueueJob(student, doc, pages, type);

    // Reset inputs
    studentInput.value = '';
    docInput.value = '';
    pagesInput.value = '5';
  });
}

async function enqueueJob(studentName, documentName, pageCount, docType = 'PDF', customId = '') {
  const timestamp = getFormattedTime();

  if (State.isBackendConnected) {
    try {
      const res = await fetch(`${CONFIG.apiBase}/api/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, documentName, pageCount, docType, jobId: customId })
      });
      if (res.ok) {
        const data = await res.json();
        await loadBackendQueue();
        await syncWithBackend();
        addLogEntry(timestamp, 'ENQUEUE', `Enqueued ${data.job.jobId} (${studentName}, ${pageCount}p) at rear of queue.`);
        notify(`Job ${data.job.jobId} added to rear of queue.`, 'success');
        return data.job;
      }
    } catch (err) {
      console.warn('Backend enqueue failed, falling back to local:', err);
    }
  }

  // Standalone local execution
  const jobId = customId || `JOB-${State.stats.jobSequence}`;
  State.stats.jobSequence++;
  State.stats.totalSubmitted++;

  const newJob = {
    jobId,
    studentName,
    documentName,
    pageCount,
    arrivalSequence: State.stats.totalSubmitted,
    docType,
    status: 'WAITING',
    submittedTime: timestamp,
    estimatedPrintTimeSec: pageCount
  };

  State.queue.push(newJob);
  addLogEntry(timestamp, 'ENQUEUE', `Enqueued ${newJob.jobId} (${studentName}, ${pageCount}p) at rear of queue.`);
  notify(`Job ${jobId} added to rear of queue.`, 'success');

  updateUI();
  return newJob;
}

// =============================================================================
// PRINTER CONTROLS & PRINTING SIMULATION
// =============================================================================

function setupPrinterControls() {
  document.getElementById('btnPrintNext').addEventListener('click', () => {
    printNextJob();
  });

  document.getElementById('btnAutoPrint').addEventListener('click', () => {
    State.autoPrintEnabled = true;
    document.getElementById('btnAutoPrint').style.display = 'none';
    document.getElementById('btnPausePrint').style.display = 'inline-flex';
    notify('Auto-print enabled. Processing queue in FIFO order.', 'info');
    printNextJob();
  });

  document.getElementById('btnPausePrint').addEventListener('click', () => {
    pausePrinting();
  });

  document.getElementById('btnResumePrint').addEventListener('click', () => {
    resumePrinting();
  });

  document.getElementById('btnPeekFront').addEventListener('click', () => {
    peekOperation('front');
  });

  document.getElementById('btnPeekRear').addEventListener('click', () => {
    peekOperation('rear');
  });

  document.getElementById('btnClearQueue').addEventListener('click', () => {
    clearWaitingQueue();
  });

  document.getElementById('btnResetSimulation').addEventListener('click', () => {
    resetSimulation();
  });

  document.getElementById('btnClearLogs').addEventListener('click', () => {
    document.getElementById('logContainer').innerHTML = '';
  });
}

async function printNextJob() {
  if (State.printerStatus === 'PRINTING') {
    notify('Printer is currently busy printing a document.', 'warning');
    return;
  }

  if (State.queue.length === 0) {
    notify('Waiting queue is empty. No documents to print.', 'info');
    if (State.autoPrintEnabled) {
      stopAutoPrint();
    }
    return;
  }

  let jobToPrint = null;

  if (State.isBackendConnected) {
    try {
      const res = await fetch(`${CONFIG.apiBase}/api/print/next`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        jobToPrint = data.job;
        await loadBackendQueue();
        await syncWithBackend();
      } else {
        const err = await res.json();
        notify(err.error || 'Cannot print next job.', 'danger');
        return;
      }
    } catch (e) {
      console.warn('Backend call failed, using local:', e);
    }
  }

  if (!jobToPrint) {
    // Local FIFO Dequeue: Front element is at index 0
    jobToPrint = State.queue.shift();
    jobToPrint.status = 'PRINTING';
  }

  State.currentJob = jobToPrint;
  State.printerStatus = 'PRINTING';
  State.currentPrintingPage = 0;

  addLogEntry(getFormattedTime(), 'DEQUEUE', `Dequeued ${jobToPrint.jobId} from front. Transferred to printer.`);
  updateUI();

  // Run the page-by-page printing simulation
  simulateJobPrinting(jobToPrint);
}

function simulateJobPrinting(job) {
  const paperSheet = document.getElementById('printerPaperSheet');
  const lcdProgressContainer = document.getElementById('lcdProgressContainer');
  const lcdProgressBar = document.getElementById('lcdProgressBar');
  const lcdProgressText = document.getElementById('lcdProgressText');
  const lcdBodyContent = document.getElementById('lcdBodyContent');
  const lcdStateText = document.getElementById('lcdStateText');

  paperSheet.classList.add('feeding');
  lcdProgressContainer.style.display = 'block';
  lcdStateText.textContent = 'PRINTING IN PROGRESS';
  lcdStateText.style.color = '#38bdf8';

  const totalPages = job.pageCount;

  // Clear existing timer if any
  if (State.printTimer) clearInterval(State.printTimer);

  State.printTimer = setInterval(async () => {
    if (State.printerStatus === 'PAUSED') {
      return; // Hold progress while paused
    }

    State.currentPrintingPage++;

    const percent = Math.min(100, Math.round((State.currentPrintingPage / totalPages) * 100));
    lcdProgressBar.style.width = `${percent}%`;
    lcdProgressText.textContent = `${percent}% (Page ${State.currentPrintingPage}/${totalPages})`;

    lcdBodyContent.innerHTML = `
      <div class="lcd-job-info">
        <div class="lcd-job-title">${escapeHtml(job.documentName)}</div>
        <div class="lcd-job-sub">${escapeHtml(job.studentName)} • ${job.jobId} • Page ${State.currentPrintingPage} of ${totalPages}</div>
      </div>
    `;

    // Notify backend of page progress
    if (State.isBackendConnected) {
      fetch(`${CONFIG.apiBase}/api/print/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: State.currentPrintingPage })
      }).catch(() => {});
    }

    // Finished printing?
    if (State.currentPrintingPage >= totalPages) {
      clearInterval(State.printTimer);
      State.printTimer = null;
      await finishCurrentJob(job);
    }
  }, CONFIG.pagePrintSpeedMs);
}

async function finishCurrentJob(job) {
  job.status = 'COMPLETED';
  job.completedTime = getFormattedTime();

  if (State.isBackendConnected) {
    try {
      await fetch(`${CONFIG.apiBase}/api/print/complete`, { method: 'POST' });
      await loadBackendHistory();
      await syncWithBackend();
    } catch (e) {
      console.warn('Backend complete call failed:', e);
    }
  }

  // Local state update
  State.completedJobs.unshift(job);
  State.stats.totalCompleted++;
  State.stats.totalPagesPrinted += job.pageCount;
  State.currentJob = null;
  State.currentPrintingPage = 0;
  State.printerStatus = 'IDLE';

  addLogEntry(getFormattedTime(), 'PRINT_COMPLETED', `Completed printing ${job.jobId} (${job.pageCount} pages).`);
  notify(`Successfully finished printing ${job.jobId} (${job.studentName}).`, 'success');

  updateUI();

  // If auto-print is enabled, automatically trigger next FIFO job
  if (State.autoPrintEnabled) {
    setTimeout(() => {
      if (State.autoPrintEnabled && State.queue.length > 0) {
        printNextJob();
      } else if (State.queue.length === 0) {
        stopAutoPrint();
        notify('All pending jobs completed! Queue is now empty.', 'success');
      }
    }, 600);
  }
}

function pausePrinting() {
  if (State.printerStatus !== 'PRINTING') return;

  State.printerStatus = 'PAUSED';
  document.getElementById('btnPausePrint').style.display = 'none';
  document.getElementById('btnResumePrint').style.display = 'inline-flex';

  const paperSheet = document.getElementById('printerPaperSheet');
  paperSheet.classList.remove('feeding');

  const lcdStateText = document.getElementById('lcdStateText');
  lcdStateText.textContent = 'PRINTER PAUSED';
  lcdStateText.style.color = '#f59e0b';

  if (State.isBackendConnected) {
    fetch(`${CONFIG.apiBase}/api/print/pause`, { method: 'POST' }).catch(() => {});
  }

  addLogEntry(getFormattedTime(), 'PAUSE', 'Printer paused by user.');
  notify('Printing paused.', 'warning');
  updateUI();
}

function resumePrinting() {
  if (State.printerStatus !== 'PAUSED') return;

  State.printerStatus = 'PRINTING';
  document.getElementById('btnResumePrint').style.display = 'none';
  document.getElementById('btnPausePrint').style.display = 'inline-flex';

  const paperSheet = document.getElementById('printerPaperSheet');
  paperSheet.classList.add('feeding');

  const lcdStateText = document.getElementById('lcdStateText');
  lcdStateText.textContent = 'PRINTING IN PROGRESS';
  lcdStateText.style.color = '#38bdf8';

  if (State.isBackendConnected) {
    fetch(`${CONFIG.apiBase}/api/print/resume`, { method: 'POST' }).catch(() => {});
  }

  addLogEntry(getFormattedTime(), 'RESUME', 'Printer resumed.');
  notify('Printing resumed.', 'info');
  updateUI();
}

function stopAutoPrint() {
  State.autoPrintEnabled = false;
  document.getElementById('btnAutoPrint').style.display = 'inline-flex';
  document.getElementById('btnPausePrint').style.display = 'none';
  document.getElementById('btnResumePrint').style.display = 'none';
}

async function peekOperation(target) {
  let job = null;

  if (State.isBackendConnected) {
    try {
      const res = await fetch(`${CONFIG.apiBase}/api/peek/${target}`);
      if (res.ok) {
        const data = await res.json();
        job = data.job;
      } else {
        const err = await res.json();
        notify(err.error || `Queue is empty. Cannot peek ${target}.`, 'warning');
        return;
      }
    } catch (e) {}
  }

  if (!job) {
    if (State.queue.length === 0) {
      notify(`Queue is empty. Cannot peek ${target}.`, 'warning');
      return;
    }
    job = (target === 'front') ? State.queue[0] : State.queue[State.queue.length - 1];
  }

  const opName = (target === 'front') ? 'PEEK_FRONT' : 'PEEK_REAR';
  addLogEntry(getFormattedTime(), opName, `Inspected ${target} element: ${job.jobId} without removing.`);

  // Open inspector modal
  openInspectorModal(`Queue ${target.toUpperCase()} Element Inspector`, job, target);
}

async function clearWaitingQueue() {
  if (State.queue.length === 0) {
    notify('Waiting queue is already empty.', 'info');
    return;
  }

  const count = State.queue.length;

  if (State.isBackendConnected) {
    try {
      await fetch(`${CONFIG.apiBase}/api/clear`, { method: 'POST' });
      await loadBackendQueue();
      await syncWithBackend();
    } catch (e) {}
  }

  State.queue = [];
  addLogEntry(getFormattedTime(), 'CLEAR_QUEUE', `Cleared ${count} waiting jobs from queue.`);
  notify(`Cleared ${count} waiting jobs from the queue. (Active printing job preserved).`, 'info');
  updateUI();
}

async function resetSimulation() {
  if (State.printTimer) {
    clearInterval(State.printTimer);
    State.printTimer = null;
  }

  if (State.isBackendConnected) {
    try {
      await fetch(`${CONFIG.apiBase}/api/reset`, { method: 'POST' });
    } catch (e) {}
  }

  State.queue = [];
  State.completedJobs = [];
  State.currentJob = null;
  State.currentPrintingPage = 0;
  State.printerStatus = 'IDLE';
  State.autoPrintEnabled = false;
  State.stats = {
    totalSubmitted: 0,
    totalCompleted: 0,
    totalPagesPrinted: 0,
    jobSequence: 101
  };

  stopAutoPrint();
  addLogEntry(getFormattedTime(), 'RESET', 'Simulation completely reset.');
  notify('Simulation reset to initial state.', 'info');
  updateUI();
}

// =============================================================================
// DEMONSTRATION SCENARIO (Sayali, Rahul, Priya)
// =============================================================================

async function loadDemoScenario() {
  // Clear any existing timer
  if (State.printTimer) {
    clearInterval(State.printTimer);
    State.printTimer = null;
  }

  if (State.isBackendConnected) {
    try {
      await fetch(`${CONFIG.apiBase}/api/demo`, { method: 'POST' });
      await loadBackendQueue();
      await loadBackendHistory();
      await syncWithBackend();
      notify('Loaded demonstration scenario (JOB-101, JOB-102, JOB-103).', 'success');
      return;
    } catch (e) {}
  }

  // Standalone local demo load
  State.queue = [];
  State.currentJob = null;
  State.currentPrintingPage = 0;
  State.printerStatus = 'IDLE';
  State.stats.jobSequence = 104;
  State.stats.totalSubmitted = 3;

  const demoJobs = [
    {
      jobId: 'JOB-101',
      studentName: 'Sayali',
      documentName: 'DSA_Assignment.pdf',
      pageCount: 5,
      arrivalSequence: 1,
      docType: 'PDF',
      status: 'WAITING',
      submittedTime: getFormattedTime(),
      estimatedPrintTimeSec: 5
    },
    {
      jobId: 'JOB-102',
      studentName: 'Rahul',
      documentName: 'OS_Notes.pdf',
      pageCount: 10,
      arrivalSequence: 2,
      docType: 'PDF',
      status: 'WAITING',
      submittedTime: getFormattedTime(),
      estimatedPrintTimeSec: 10
    },
    {
      jobId: 'JOB-103',
      studentName: 'Priya',
      documentName: 'DBMS_Project.pdf',
      pageCount: 7,
      arrivalSequence: 3,
      docType: 'PDF',
      status: 'WAITING',
      submittedTime: getFormattedTime(),
      estimatedPrintTimeSec: 7
    }
  ];

  State.queue = demoJobs;
  addLogEntry(getFormattedTime(), 'DEMO_LOAD', 'Loaded demo jobs: JOB-101 (Sayali), JOB-102 (Rahul), JOB-103 (Priya).');
  notify('Demo loaded: JOB-101 (Sayali 5p), JOB-102 (Rahul 10p), JOB-103 (Priya 7p).', 'success');
  updateUI();
}

// =============================================================================
// UI RENDERING & QUEUE VISUALIZER
// =============================================================================

function updateUI() {
  updateMetricsDisplay();
  renderQueueCards();
  renderPrinterDisplay();
  renderCompletedTable();
  updateLabInspector();
}

function updateMetricsDisplay(externalEstWaitSec = null) {
  document.getElementById('statTotalSubmitted').textContent = State.stats.totalSubmitted;
  document.getElementById('statPendingJobs').textContent = State.queue.length;
  document.getElementById('statCompletedJobs').textContent = State.stats.totalCompleted;
  document.getElementById('statTotalPages').textContent = State.stats.totalPagesPrinted;

  const statusEl = document.getElementById('statPrinterStatus');
  statusEl.textContent = State.printerStatus;
  statusEl.className = 'metric-value';

  if (State.printerStatus === 'PRINTING') {
    statusEl.classList.add('status-text-printing');
  } else if (State.printerStatus === 'PAUSED') {
    statusEl.classList.add('status-text-paused');
  } else {
    statusEl.classList.add('status-text-idle');
  }

  // Calculate estimated wait time
  let estSec = 0;
  if (externalEstWaitSec !== null) {
    estSec = externalEstWaitSec;
  } else {
    if (State.currentJob) {
      estSec += (State.currentJob.pageCount - State.currentPrintingPage);
    }
    State.queue.forEach(j => { estSec += j.pageCount; });
  }
  document.getElementById('statEstTime').textContent = `Est. Wait: ${estSec}s`;

  // Visualizer header badges
  document.getElementById('lblQueueSize').textContent = `${State.queue.length} Jobs Waiting`;
  document.getElementById('lblFrontId').textContent = State.queue.length > 0 ? State.queue[0].jobId : 'None';
  document.getElementById('lblRearId').textContent = State.queue.length > 0 ? State.queue[State.queue.length - 1].jobId : 'None';
}

function renderPrinterDisplay() {
  const led = document.getElementById('printerLed');
  const paperSheet = document.getElementById('printerPaperSheet');
  const lcdStateText = document.getElementById('lcdStateText');
  const lcdBodyContent = document.getElementById('lcdBodyContent');
  const lcdProgressContainer = document.getElementById('lcdProgressContainer');
  const btnPrintNext = document.getElementById('btnPrintNext');

  btnPrintNext.disabled = (State.printerStatus === 'PRINTING');

  if (State.printerStatus === 'IDLE') {
    led.className = 'dot-indicator';
    paperSheet.classList.remove('feeding');
    lcdProgressContainer.style.display = 'none';
    lcdStateText.textContent = 'READY FOR JOBS';
    lcdStateText.style.color = '#7dd3fc';
    lcdBodyContent.innerHTML = `
      <div class="lcd-idle-message">
        <p>Printer idle. Queue is ready.</p>
        <small>Jobs process strictly in First-In, First-Out (FIFO) order.</small>
      </div>
    `;
  } else if (State.printerStatus === 'PRINTING' && State.currentJob) {
    led.className = 'dot-indicator printing';
    // Printing progress and body are updated inside simulateJobPrinting
  } else if (State.printerStatus === 'PAUSED') {
    led.className = 'dot-indicator paused';
    paperSheet.classList.remove('feeding');
    lcdStateText.textContent = 'PRINTER PAUSED';
    lcdStateText.style.color = '#f59e0b';
  }
}

function renderQueueCards() {
  const placeholder = document.getElementById('queueEmptyPlaceholder');
  const container = document.getElementById('queueCardsContainer');

  if (State.queue.length === 0) {
    placeholder.style.display = 'block';
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  placeholder.style.display = 'none';
  container.style.display = 'flex';
  container.innerHTML = '';

  State.queue.forEach((job, index) => {
    const isFront = (index === 0);
    const isRear = (index === State.queue.length - 1);

    const wrapper = document.createElement('div');
    wrapper.className = 'doc-card-wrapper';
    wrapper.id = `cardWrapper-${job.jobId}`;

    let icon = '📄';
    if (job.docType === 'CODE') icon = '💻';
    else if (job.docType === 'DOCX') icon = '📝';
    else if (job.docType === 'PPTX') icon = '📊';
    else if (job.docType === 'SHEET') icon = '📈';

    wrapper.innerHTML = `
      <div class="doc-card ${isFront ? 'is-front' : ''} ${isRear ? 'is-rear' : ''}">
        ${isFront ? '<span class="doc-pointer-banner banner-front">FRONT (Next)</span>' : ''}
        ${isRear ? '<span class="doc-pointer-banner banner-rear">REAR (Last)</span>' : ''}

        <div class="doc-card-header">
          <span class="doc-id-pill">${job.jobId}</span>
          <span class="doc-seq-badge">#${job.arrivalSequence}</span>
        </div>

        <div class="doc-title-row">
          <span class="doc-icon">${icon}</span>
          <span class="doc-filename" title="${escapeHtml(job.documentName)}">${escapeHtml(job.documentName)}</span>
        </div>

        <div class="doc-student-name">Student: <strong>${escapeHtml(job.studentName)}</strong></div>

        <div class="doc-card-footer">
          <span class="doc-pages">${job.pageCount} ${job.pageCount === 1 ? 'page' : 'pages'}</span>
          <span class="doc-status-badge status-waiting">WAITING</span>
        </div>
      </div>
      ${!isRear ? '<div class="queue-arrow" title="FIFO Processing Direction">➡</div>' : ''}
    `;

    container.appendChild(wrapper);
  });
}

function renderCompletedTable() {
  const tbody = document.getElementById('tbodyCompletedJobs');
  const countBadge = document.getElementById('lblCompletedCount');
  countBadge.textContent = `${State.completedJobs.length} Printed`;

  if (State.completedJobs.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-table-row">
        <td colspan="8">No print jobs completed yet. Process jobs from the dashboard.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  State.completedJobs.forEach((job, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:#60a5fa; font-family:var(--font-mono);">${job.jobId}</strong></td>
      <td>${escapeHtml(job.studentName)}</td>
      <td>${escapeHtml(job.documentName)}</td>
      <td>${job.pageCount}</td>
      <td>#${job.arrivalSequence}</td>
      <td>#${idx + 1}</td>
      <td><span class="badge badge-success">COMPLETED</span></td>
      <td>${job.completedTime || job.submittedTime || '--:--'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function addLogEntry(time, operation, details, prepend = true) {
  const container = document.getElementById('logContainer');
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  let badgeClass = 'badge-info';
  if (operation.includes('DEQUEUE') || operation.includes('COMPLETED')) badgeClass = 'badge-success';
  if (operation.includes('ENQUEUE')) badgeClass = 'badge-accent';
  if (operation.includes('CLEAR') || operation.includes('UNDERFLOW')) badgeClass = 'badge-danger';
  if (operation.includes('PAUSE')) badgeClass = 'badge-warning';

  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-badge ${badgeClass}">${operation}</span>
    <span class="log-desc">${escapeHtml(details)}</span>
  `;

  if (prepend && container.firstChild) {
    container.insertBefore(entry, container.firstChild);
  } else {
    container.appendChild(entry);
  }
}

// =============================================================================
// QUEUE LABORATORY WORKBENCH
// =============================================================================

function setupQueueLab() {
  document.getElementById('btnLabEnqueue').addEventListener('click', async () => {
    const name = document.getElementById('labStudentName').value.trim() || 'Student';
    const doc = document.getElementById('labDocName').value.trim() || 'Document.pdf';
    const pages = parseInt(document.getElementById('labPages').value, 10) || 3;

    const beforeSnapshot = getQueueVisualSnapshot();
    const newJob = await enqueueJob(name, doc, pages, 'PDF');
    const afterSnapshot = getQueueVisualSnapshot();

    setLabTransition(
      `enqueue(${newJob.jobId})`,
      beforeSnapshot,
      afterSnapshot,
      `The new node for <strong>${newJob.jobId}</strong> is attached to <code>rearPtr->next</code>, and <code>rearPtr</code> is updated to point to it. The arrival order of all previous elements remains completely undisturbed. <em>Time Complexity: O(1)</em>.`
    );
    document.getElementById('underflowAlert').style.display = 'none';
    updateLabInspector();
  });

  document.getElementById('btnLabDequeue').addEventListener('click', async () => {
    const underflowAlert = document.getElementById('underflowAlert');

    if (State.queue.length === 0) {
      // Trigger Queue Underflow Demonstration
      underflowAlert.style.display = 'flex';
      setLabTransition(
        'dequeue() [UNDERFLOW EXCEPTION]',
        '[Empty Queue]',
        '[Empty Queue]',
        `<strong>Queue Underflow:</strong> The queue contains 0 elements (<code>frontPtr == nullptr</code>). Dequeue cannot proceed. The C++ implementation intercepts this condition and throws <code>QueueUnderflowException</code> to prevent segmentation fault.`
      );
      addLogEntry(getFormattedTime(), 'UNDERFLOW_ERROR', 'Queue Underflow encountered during lab dequeue operation.');
      return;
    }

    underflowAlert.style.display = 'none';
    const beforeSnapshot = getQueueVisualSnapshot();
    const frontJob = State.queue[0];

    if (State.isBackendConnected) {
      try {
        await fetch(`${CONFIG.apiBase}/api/dequeue`, { method: 'POST' });
        await loadBackendQueue();
        await syncWithBackend();
      } catch (e) {}
    } else {
      State.queue.shift();
    }

    const afterSnapshot = getQueueVisualSnapshot();
    setLabTransition(
      `dequeue() -> ${frontJob.jobId}`,
      beforeSnapshot,
      afterSnapshot,
      `The job at <code>frontPtr</code> (<strong>${frontJob.jobId}</strong>) was removed. <code>frontPtr</code> advanced to <code>frontPtr->next</code>. Memory of the dequeued node is reclaimed. <em>Time Complexity: O(1)</em>.`
    );

    addLogEntry(getFormattedTime(), 'LAB_DEQUEUE', `Dequeued ${frontJob.jobId} from front via laboratory.`);
    updateUI();
  });

  document.getElementById('btnLabPeekFront').addEventListener('click', () => {
    if (State.queue.length === 0) {
      setLabTransition('peekFront()', '[Empty]', '[Empty]', 'Cannot peek front: queue is empty.');
      notify('Queue is empty. Front cannot be inspected.', 'warning');
      return;
    }
    const front = State.queue[0];
    setLabTransition(
      'peekFront()',
      getQueueVisualSnapshot(),
      getQueueVisualSnapshot(),
      `Front element inspected: <strong>${front.jobId}</strong> (${front.studentName}, ${front.pageCount}p). The queue remains unchanged because peekFront() does not remove elements.`
    );
  });

  document.getElementById('btnLabPeekRear').addEventListener('click', () => {
    if (State.queue.length === 0) {
      setLabTransition('peekRear()', '[Empty]', '[Empty]', 'Cannot peek rear: queue is empty.');
      notify('Queue is empty. Rear cannot be inspected.', 'warning');
      return;
    }
    const rear = State.queue[State.queue.length - 1];
    setLabTransition(
      'peekRear()',
      getQueueVisualSnapshot(),
      getQueueVisualSnapshot(),
      `Rear element inspected: <strong>${rear.jobId}</strong> (${rear.studentName}, ${rear.pageCount}p). The queue remains unchanged.`
    );
  });

  document.getElementById('btnLabIsEmpty').addEventListener('click', () => {
    const empty = (State.queue.length === 0);
    setLabTransition(
      'isEmpty()',
      getQueueVisualSnapshot(),
      getQueueVisualSnapshot(),
      `Returned: <strong>${empty ? 'true' : 'false'}</strong>. The queue currently has ${State.queue.length} elements waiting.`
    );
    notify(`isEmpty() returned: ${empty ? 'true (Queue is empty)' : 'false (Queue has items)'}`, 'info');
  });

  document.getElementById('btnLabClear').addEventListener('click', () => {
    const before = getQueueVisualSnapshot();
    clearWaitingQueue();
    setLabTransition('clearQueue()', before, '[Empty Queue]', 'All nodes deallocated and pointers reset to nullptr.');
  });
}

function updateLabInspector() {
  const frontVal = document.getElementById('valFrontPointer');
  const rearVal = document.getElementById('valRearPointer');
  const bridgeCount = document.getElementById('bridgeNodeCount');
  const sizeBadge = document.getElementById('labSizeBadge');

  const size = State.queue.length;
  sizeBadge.textContent = `Size: ${size}`;
  bridgeCount.textContent = `${size} Nodes in Memory`;

  if (size === 0) {
    frontVal.textContent = 'nullptr';
    rearVal.textContent = 'nullptr';
  } else {
    frontVal.textContent = State.queue[0].jobId;
    rearVal.textContent = State.queue[size - 1].jobId;
  }
}

function setLabTransition(op, before, after, explanation) {
  document.getElementById('transOpName').textContent = op;
  document.getElementById('transBeforeState').textContent = before;
  document.getElementById('transAfterState').textContent = after;
  document.getElementById('transExplanation').innerHTML = explanation;
}

function getQueueVisualSnapshot() {
  if (State.queue.length === 0) return '[Empty Queue]';
  return State.queue.map(j => j.jobId).join(' → ');
}

// =============================================================================
// FIFO CHALLENGE GAME ENGINE (3 Levels, Timer, Streaks, Explanations)
// =============================================================================

const GameData = {
  currentLevel: 1,
  currentQuestionIndex: 0,
  score: 0,
  streak: 0,
  maxStreak: 0,
  correctCount: 0,
  timer: 20,
  timerInterval: null,
  activeQuestion: null,

  levels: {
    1: {
      name: 'Level 1: Basic FIFO',
      questions: [
        {
          question: 'In a standard FIFO print queue with the waiting documents shown below, which document will print NEXT?',
          queue: ['JOB-101 (Sayali)', 'JOB-102 (Rahul)', 'JOB-103 (Priya)'],
          answers: [
            { text: 'JOB-101 (Sayali)', correct: true },
            { text: 'JOB-102 (Rahul)', correct: false },
            { text: 'JOB-103 (Priya)', correct: false },
            { text: 'Whichever document has the fewest pages', correct: false }
          ],
          explanation: 'In a FIFO (First-In, First-Out) queue, elements are serviced strictly in arrival order from the front of the queue. JOB-101 arrived first, so it prints next.'
        },
        {
          question: 'If JOB-104 (Amit) arrives while JOB-101 is being printed, where does JOB-104 enter the queue?',
          queue: ['JOB-102 (Rahul)', 'JOB-103 (Priya)'],
          answers: [
            { text: 'At the front (before JOB-102)', correct: false },
            { text: 'At the rear (behind JOB-103)', correct: true },
            { text: 'In the middle between JOB-102 and JOB-103', correct: false },
            { text: 'It replaces JOB-101 immediately', correct: false }
          ],
          explanation: 'New print requests in a queue always enqueue at the REAR pointer. Thus JOB-104 joins behind Priya (JOB-103).'
        },
        {
          question: 'What is the time complexity of the enqueue and dequeue operations in an optimal linked-list queue?',
          queue: ['[frontPtr] ➔ Node 1 ➔ Node 2 ➔ Node 3 ➔ [rearPtr]'],
          answers: [
            { text: 'O(1) for both enqueue and dequeue', correct: true },
            { text: 'O(n) for enqueue, O(1) for dequeue', correct: false },
            { text: 'O(log n) for both', correct: false },
            { text: 'O(n) for both', correct: false }
          ],
          explanation: 'Because the queue maintains direct front and rear pointers, inserting at rear and removing from front both execute in constant O(1) time.'
        },
        {
          question: 'Which method inspects the next element to be processed without removing it from the queue?',
          queue: ['Front: JOB-101 | Waiting: 3 jobs'],
          answers: [
            { text: 'dequeue()', correct: false },
            { text: 'peekFront() / std::queue::front()', correct: true },
            { text: 'peekRear() / std::queue::back()', correct: false },
            { text: 'clearQueue()', correct: false }
          ],
          explanation: 'peekFront() (or front() in C++ std::queue) reads the front element without altering the queue size or pointers.'
        }
      ]
    },
    2: {
      name: 'Level 2: Queue Operations',
      questions: [
        {
          question: 'An empty queue performs: enqueue(A), enqueue(B), dequeue(), enqueue(C). What is the queue from front to rear?',
          queue: ['enqueue(A)', 'enqueue(B)', 'dequeue()', 'enqueue(C)'],
          answers: [
            { text: 'B → C', correct: true },
            { text: 'A → B → C', correct: false },
            { text: 'C → B', correct: false },
            { text: 'A → C', correct: false }
          ],
          explanation: '1. enqueue(A) -> [A]\n2. enqueue(B) -> [A, B]\n3. dequeue() removes front (A) -> [B]\n4. enqueue(C) adds to rear -> [B, C].'
        },
        {
          question: 'What occurs if dequeue() is called on an empty queue (frontPtr == nullptr)?',
          queue: ['frontPtr == nullptr | size == 0'],
          answers: [
            { text: 'Queue Underflow Exception', correct: true },
            { text: 'Queue Overflow Exception', correct: false },
            { text: 'It returns a random element', correct: false },
            { text: 'The program adds a default null node', correct: false }
          ],
          explanation: 'Attempting to remove from an empty queue triggers a Queue Underflow error, safely trapped by custom exceptions or assertions in C++.'
        },
        {
          question: 'Given queue: [Front] X → Y → Z [Rear]. What will be the front element after TWO dequeue operations?',
          queue: ['X → Y → Z'],
          answers: [
            { text: 'Z', correct: true },
            { text: 'Y', correct: false },
            { text: 'X', correct: false },
            { text: 'Queue becomes empty', correct: false }
          ],
          explanation: 'First dequeue removes X. Second dequeue removes Y. Only Z remains at the front.'
        },
        {
          question: 'In C++ STL, does std::queue::pop() return the value of the removed element?',
          queue: ['std::queue<PrintJob> q;'],
          answers: [
            { text: 'No, pop() has void return type in C++ STL', correct: true },
            { text: 'Yes, it returns the removed element directly', correct: false },
            { text: 'Yes, but only if the queue is not empty', correct: false },
            { text: 'It returns a boolean indicating success', correct: false }
          ],
          explanation: 'In C++ STL, std::queue::pop() returns void for exception safety. You must call q.front() before q.pop() to retrieve the element.'
        }
      ]
    },
    3: {
      name: 'Level 3: Printer Challenge',
      questions: [
        {
          question: 'Student A submits 20 pages. Student B submits 2 pages 5 seconds later. Which document finishes printing first?',
          queue: ['Student A (20 pages)', 'Student B (2 pages)'],
          answers: [
            { text: 'Student A (FIFO strict arrival priority)', correct: true },
            { text: 'Student B (Shortest Job First priority)', correct: false },
            { text: 'Both print simultaneously', correct: false },
            { text: 'Student B preempts Student A', correct: false }
          ],
          explanation: 'A pure FIFO print queue prioritizes arrival time over page count. Even though B is shorter, A arrived first and holds the printer.'
        },
        {
          question: 'If the queue has 3 jobs of 5 pages, 10 pages, and 2 pages, how long does the 3rd job have to wait to start (at 1 sec/page)?',
          queue: ['Job 1 (5 pages)', 'Job 2 (10 pages)', 'Job 3 (2 pages)'],
          answers: [
            { text: '15 seconds', correct: true },
            { text: '17 seconds', correct: false },
            { text: '5 seconds', correct: false },
            { text: '2 seconds', correct: false }
          ],
          explanation: 'Job 3 must wait until both preceding jobs complete: 5 pages + 10 pages = 15 seconds.'
        },
        {
          question: 'During active printing of JOB-101, user clicks "Clear Waiting Queue". What should happen?',
          queue: ['Printing: JOB-101 | Waiting: JOB-102, JOB-103'],
          answers: [
            { text: 'Waiting queue clears, but JOB-101 finishes printing', correct: true },
            { text: 'JOB-101 is abruptly destroyed and cancelled', correct: false },
            { text: 'The entire printer crashes with undefined behavior', correct: false },
            { text: 'Clearing is refused until printing finishes', correct: false }
          ],
          explanation: 'Proper state isolation ensures that clearing the waiting queue deallocates waiting nodes without abruptly tearing down the active hardware printing process.'
        }
      ]
    }
  }
};

function setupGameEngine() {
  // Level selector buttons
  document.querySelectorAll('.level-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const lvl = parseInt(tab.getAttribute('data-level'), 10);
      startLevel(lvl);
    });
  });

  document.getElementById('btnGameNextQuestion').addEventListener('click', nextQuestion);
  document.getElementById('btnRestartGame').addEventListener('click', () => {
    document.getElementById('gameSummaryModal').style.display = 'none';
    startLevel(1);
  });

  // Start with Level 1
  startLevel(1);
}

function startLevel(levelNum) {
  GameData.currentLevel = levelNum;
  GameData.currentQuestionIndex = 0;
  GameData.score = 0;
  GameData.streak = 0;
  GameData.correctCount = 0;

  document.getElementById('gameScore').textContent = '0';
  document.getElementById('gameStreak').textContent = '0 🔥';
  document.getElementById('gameLevelBadge').textContent = GameData.levels[levelNum].name;

  loadQuestion();
}

function loadQuestion() {
  const levelInfo = GameData.levels[GameData.currentLevel];
  const qList = levelInfo.questions;

  if (GameData.currentQuestionIndex >= qList.length) {
    showGameSummary();
    return;
  }

  const q = qList[GameData.currentQuestionIndex];
  GameData.activeQuestion = q;

  document.getElementById('gameQuestionCounter').textContent = `Question ${GameData.currentQuestionIndex + 1} of ${qList.length}`;
  document.getElementById('gameQuestionText').textContent = q.question;

  // Render visual queue representation for the question
  const visual = document.getElementById('gameScenarioVisual');
  visual.innerHTML = '';
  q.queue.forEach((item, idx) => {
    const chip = document.createElement('div');
    chip.className = 'doc-card';
    chip.style.width = 'auto';
    chip.style.padding = '0.5rem 0.85rem';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '0.5rem';
    chip.innerHTML = `<strong>#${idx + 1}</strong> <span>${escapeHtml(item)}</span>`;
    visual.appendChild(chip);

    if (idx < q.queue.length - 1) {
      const arr = document.createElement('span');
      arr.style.color = '#64748b';
      arr.textContent = '➡';
      visual.appendChild(arr);
    }
  });

  // Render Answers
  const answersGrid = document.getElementById('gameAnswersGrid');
  answersGrid.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  q.answers.forEach((ans, idx) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.innerHTML = `
      <span class="answer-letter">${letters[idx]}</span>
      <span class="answer-text">${escapeHtml(ans.text)}</span>
    `;
    btn.addEventListener('click', () => handleAnswerSelect(btn, ans));
    answersGrid.appendChild(btn);
  });

  // Reset feedback box
  const feedback = document.getElementById('gameFeedbackBox');
  feedback.style.display = 'none';
  feedback.className = 'game-feedback-box';

  // Start timer
  startQuestionTimer();
}

function startQuestionTimer() {
  if (GameData.timerInterval) clearInterval(GameData.timerInterval);
  GameData.timer = 20;
  const timerEl = document.getElementById('gameTimer');
  timerEl.textContent = `${GameData.timer}s`;

  GameData.timerInterval = setInterval(() => {
    GameData.timer--;
    timerEl.textContent = `${GameData.timer}s`;

    if (GameData.timer <= 0) {
      clearInterval(GameData.timerInterval);
      handleTimeOut();
    }
  }, 1000);
}

function handleAnswerSelect(selectedBtn, answer) {
  if (GameData.timerInterval) clearInterval(GameData.timerInterval);

  // Disable all buttons
  const allBtns = document.querySelectorAll('.answer-btn');
  allBtns.forEach(b => b.disabled = true);

  const feedback = document.getElementById('gameFeedbackBox');
  const feedbackIcon = document.getElementById('feedbackIcon');
  const feedbackTitle = document.getElementById('feedbackTitle');
  const feedbackText = document.getElementById('feedbackText');

  if (answer.correct) {
    selectedBtn.classList.add('correct');
    GameData.streak++;
    if (GameData.streak > GameData.maxStreak) GameData.maxStreak = GameData.streak;
    GameData.correctCount++;

    const points = 100 + (GameData.streak * 20) + (GameData.timer * 5);
    GameData.score += points;

    feedback.className = 'game-feedback-box';
    feedbackIcon.textContent = '✅';
    feedbackTitle.textContent = `Correct! (+${points} pts)`;
    feedbackTitle.style.color = '#34d399';
  } else {
    selectedBtn.classList.add('wrong');
    GameData.streak = 0;

    feedback.className = 'game-feedback-box is-wrong';
    feedbackIcon.textContent = '❌';
    feedbackTitle.textContent = 'Incorrect!';
    feedbackTitle.style.color = '#f87171';

    // Highlight correct answer
    allBtns.forEach((b, idx) => {
      if (GameData.activeQuestion.answers[idx].correct) {
        b.classList.add('correct');
      }
    });
  }

  feedbackText.innerHTML = GameData.activeQuestion.explanation;
  feedback.style.display = 'block';

  document.getElementById('gameScore').textContent = GameData.score;
  document.getElementById('gameStreak').textContent = `${GameData.streak} 🔥`;
}

function handleTimeOut() {
  const allBtns = document.querySelectorAll('.answer-btn');
  allBtns.forEach(b => b.disabled = true);

  GameData.streak = 0;
  document.getElementById('gameStreak').textContent = '0 🔥';

  const feedback = document.getElementById('gameFeedbackBox');
  document.getElementById('feedbackIcon').textContent = '⏰';
  document.getElementById('feedbackTitle').textContent = 'Time Expired!';
  document.getElementById('feedbackTitle').style.color = '#f59e0b';
  document.getElementById('feedbackText').innerHTML = `Time ran out! ${GameData.activeQuestion.explanation}`;
  feedback.style.display = 'block';
}

function nextQuestion() {
  GameData.currentQuestionIndex++;
  loadQuestion();
}

function showGameSummary() {
  if (GameData.timerInterval) clearInterval(GameData.timerInterval);

  const modal = document.getElementById('gameSummaryModal');
  const total = GameData.levels[GameData.currentLevel].questions.length;
  const accuracy = Math.round((GameData.correctCount / total) * 100);

  document.getElementById('summaryScoreText').textContent = `Final Score: ${GameData.score} pts`;
  document.getElementById('summaryAccuracy').textContent = `${accuracy}%`;
  document.getElementById('summaryMaxStreak').textContent = `${GameData.maxStreak} 🔥`;
  document.getElementById('summaryTimeBonus').textContent = `+${GameData.score > 300 ? 50 : 20}`;

  const rankText = document.getElementById('summaryRankText');
  if (accuracy === 100) {
    rankText.textContent = '🌟 Queue Grandmaster! Flawless FIFO intuition.';
  } else if (accuracy >= 75) {
    rankText.textContent = '🎓 Proficient Queue Architect. Strong grasp of FIFO.';
  } else {
    rankText.textContent = '📚 Keep practicing! Review the Queue Laboratory.';
  }

  modal.style.display = 'flex';
}

// =============================================================================
// MODALS & INSPECTORS
// =============================================================================

function setupModals() {
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.style.display = 'none';
    }
  });
}

function openInspectorModal(title, job, pointerType) {
  const modal = document.getElementById('inspectorModal');
  document.getElementById('inspectorModalTitle').textContent = title;

  const body = document.getElementById('inspectorModalBody');
  body.innerHTML = `
    <div style="background:var(--bg-surface); padding:1.25rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
        <span class="badge ${pointerType === 'front' ? 'badge-success' : 'badge-accent'}">
          ${pointerType.toUpperCase()} POINTER ELEMENT
        </span>
        <strong style="color:#60a5fa; font-family:var(--font-mono);">${job.jobId}</strong>
      </div>
      <p style="margin-bottom:0.4rem;"><strong>Student Name:</strong> ${escapeHtml(job.studentName)}</p>
      <p style="margin-bottom:0.4rem;"><strong>Document Name:</strong> ${escapeHtml(job.documentName)}</p>
      <p style="margin-bottom:0.4rem;"><strong>Page Count:</strong> ${job.pageCount} pages</p>
      <p style="margin-bottom:0.4rem;"><strong>Arrival Sequence:</strong> #${job.arrivalSequence}</p>
      <p style="margin-bottom:0.4rem;"><strong>Submission Time:</strong> ${job.submittedTime || '--:--'}</p>
      <p style="margin-bottom:0;"><strong>Current Status:</strong> <span class="badge badge-warning">${job.status}</span></p>
    </div>
    <div style="margin-top:1rem; font-size:0.82rem; color:var(--text-muted); line-height:1.5;">
      ${pointerType === 'front' 
        ? 'This element will be the exact next job dequeued and delivered to the laser printer when printing begins.' 
        : 'This element was the most recently enqueued document and occupies the tail of the waiting queue.'}
    </div>
  `;

  modal.style.display = 'flex';
}

// =============================================================================
// UTILITIES
// =============================================================================

function getFormattedTime() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

function notify(message, type = 'info') {
  const existing = document.getElementById('toastNotice');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toastNotice';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #1e293b;
    border: 1px solid ${type === 'success' ? '#10b981' : type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: #fff;
    padding: 0.85rem 1.25rem;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    font-size: 0.88rem;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    animation: fadeIn 0.3s ease;
  `;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'danger') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 3500);
}
