/* ==========================================
   CROWNRIDGE LLP - CLIENT LOGIC (app.js)
   ========================================== */

// Retrieve saved API base URL or default to window.location.origin (falls back to localhost:5000 if file://)
let API_BASE_URL = localStorage.getItem('api_base_url') || 
  ((window.location.protocol === 'file:' || window.location.origin === 'null') 
    ? 'http://localhost:5000' 
    : window.location.origin);

if (API_BASE_URL.endsWith('/')) {
  API_BASE_URL = API_BASE_URL.slice(0, -1);
}

// App State
let currentReportId = null;
let currentReportMarkdown = '';
let activeRating = 0;
let severityChartInstance = null;
let ratingsChartInstance = null;

// Auth State
let currentUser = null;
let authToken = localStorage.getItem('token') || null;

// --- API FETCH WRAPPER WITH AUTHENTICATION ---
async function fetchAPI(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  options.headers = options.headers || {};
  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  if (options.body && typeof options.body === 'string' && !options.headers['Content-Type']) {
    options.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, options);
  
  if (response.status === 401) {
    logoutUser();
    throw new Error('Session expired or unauthorized. Please log in again.');
  }
  
  return response;
}

function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  authToken = null;
  currentUser = null;
  
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('user-profile-chip').classList.add('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
  
  const supNameInput = document.getElementById('supervisor_name');
  const supRoleInput = document.getElementById('supervisor_role');
  if (supNameInput) {
    supNameInput.value = '';
    supNameInput.readOnly = false;
    supNameInput.classList.remove('autofilled-locked');
  }
  if (supRoleInput) {
    supRoleInput.value = '';
    supRoleInput.readOnly = false;
    supRoleInput.classList.remove('autofilled-locked');
  }

  showToast('Logged out successfully.');
}

function applyUserProfile(user) {
  currentUser = user;
  
  const supNameInput = document.getElementById('supervisor_name');
  const supRoleInput = document.getElementById('supervisor_role');
  if (supNameInput) {
    supNameInput.value = user.full_name;
    supNameInput.readOnly = true;
    supNameInput.classList.add('autofilled-locked');
  }
  if (supRoleInput) {
    supRoleInput.value = user.role;
    supRoleInput.readOnly = true;
    supRoleInput.classList.add('autofilled-locked');
  }
  
  document.getElementById('header-user-name').textContent = user.full_name;
  document.getElementById('header-user-role').textContent = user.role;
  document.getElementById('user-profile-chip').classList.remove('hidden');
  document.getElementById('logout-btn').classList.remove('hidden');
  
  document.getElementById('login-overlay').classList.add('hidden');
  
  document.getElementById('auth-login-form').reset();
  document.getElementById('auth-register-form').reset();
  
  showToast(`Welcome back, ${user.full_name}!`);
}

async function checkAuthStatus() {
  if (!authToken) {
    document.getElementById('login-overlay').classList.remove('hidden');
    return;
  }
  
  try {
    const res = await fetchAPI('/api/auth/me');
    if (!res.ok) throw new Error('Unauthorized');
    const data = await res.json();
    
    currentUser = data.user;
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    applyUserProfile(currentUser);
    
    // Load auth-restricted data
    loadPresets();
    loadHistory();
    loadAnalytics();
  } catch (err) {
    console.error('Initial auth check failed:', err);
    logoutUser();
  }
}

function initAuthUI() {
  const loginOverlay = document.getElementById('login-overlay');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegisterBtnUi = document.getElementById('tab-register-btn-ui');
  const authLoginForm = document.getElementById('auth-login-form');
  const authRegisterForm = document.getElementById('auth-register-form');
  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');
  const logoutBtn = document.getElementById('logout-btn');
  
  const loginErrorMsg = document.getElementById('login-error-msg');
  const registerErrorMsg = document.getElementById('register-error-msg');

  function showLoginForm() {
    tabLoginBtn.classList.add('active');
    tabRegisterBtnUi.classList.remove('active');
    authLoginForm.classList.remove('hidden');
    authRegisterForm.classList.add('hidden');
    loginErrorMsg.classList.add('hidden');
  }

  function showRegisterForm() {
    tabLoginBtn.classList.remove('active');
    tabRegisterBtnUi.classList.add('active');
    authLoginForm.classList.add('hidden');
    authRegisterForm.classList.remove('hidden');
    registerErrorMsg.classList.add('hidden');
  }

  tabLoginBtn.addEventListener('click', showLoginForm);
  tabRegisterBtnUi.addEventListener('click', showRegisterForm);
  switchToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
  switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });

  authLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorMsg.classList.add('hidden');
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      authToken = data.token;
      currentUser = data.user;
      
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      
      applyUserProfile(currentUser);
      
      loadPresets();
      loadHistory();
      loadAnalytics();
    } catch (err) {
      loginErrorMsg.textContent = err.message;
      loginErrorMsg.classList.remove('hidden');
      showToast(err.message, true);
    }
  });

  authRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerErrorMsg.classList.add('hidden');
    
    const username = document.getElementById('register-username').value;
    const fullName = document.getElementById('register-fullname').value;
    const role = document.getElementById('register-role').value;
    const password = document.getElementById('register-password').value;
    
    if (password.length < 6) {
      registerErrorMsg.textContent = 'Password must be at least 6 characters.';
      registerErrorMsg.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, full_name: fullName, role })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      authToken = data.token;
      currentUser = data.user;
      
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      
      applyUserProfile(currentUser);
      
      loadPresets();
      loadHistory();
      loadAnalytics();
    } catch (err) {
      registerErrorMsg.textContent = err.message;
      registerErrorMsg.classList.remove('hidden');
      showToast(err.message, true);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetchAPI('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Backend logout failed:', err);
    }
    logoutUser();
  });
}

// DOM Elements
const navButtons = document.querySelectorAll('.nav-btn');
const viewPanels = document.querySelectorAll('.view-panel');
const formTabs = document.querySelectorAll('.tab-trigger');
const tabContents = document.querySelectorAll('.tab-content');
const presetsContainer = document.getElementById('presets-container');
const incidentForm = document.getElementById('incident-form');
const charCounterDesc = document.getElementById('char-counter-desc');
const descTextarea = document.getElementById('raw_description');

// Output states
const outputEmpty = document.getElementById('output-empty');
const outputLoading = document.getElementById('output-loading');
const outputContent = document.getElementById('output-content');
const loadingStepText = document.getElementById('loading-step-text');
const progressFill = document.getElementById('progress-fill');
const reportBody = document.getElementById('report-body');
const metaDuration = document.getElementById('meta-duration');
const metaMockBadge = document.getElementById('meta-mock-badge');

// Actions
const btnCopyReport = document.getElementById('btn-copy-report');
const btnShareReport = document.getElementById('btn-share-report');
const btnDownloadPdf = document.getElementById('btn-download-pdf');
const btnRegenerateReport = document.getElementById('btn-regenerate-report');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Feedback Elements
const feedbackPanel = document.getElementById('feedback-panel');
const starRatingControl = document.getElementById('star-rating');
const starBtns = document.querySelectorAll('.star-btn');
const ratingLabel = document.getElementById('rating-label');
const feedbackCommentWrapper = document.getElementById('feedback-comment-wrapper');
const feedbackComment = document.getElementById('feedback-comment');
const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
const feedbackSuccess = document.getElementById('feedback-success');

// Register Elements
const registerSearch = document.getElementById('register-search');
const filterSeverity = document.getElementById('filter-severity');
const filterType = document.getElementById('filter-type');
const registerTableBody = document.getElementById('register-table-body');

// Modal Elements
const reportModal = document.getElementById('report-modal');
const modalCloseBtn = document.getElementById('btn-close-modal');
const modalReportBody = document.getElementById('modal-report-body');
const modalReportTitle = document.getElementById('modal-report-title');
const modalBtnCopy = document.getElementById('modal-btn-copy');
const modalBtnPdf = document.getElementById('modal-btn-pdf');
let activeModalReportMarkdown = '';

// Toast Notification
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toast-msg');

// Initial Setup
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNavigation();
  initFormTabs();
  initCharacterCounter();
  initStarRating();
  initConnectionSettings();
  
  initAuthUI();
  await checkAuthStatus();

  // Set default date-time to now
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('incident-timestamp').value = now.toISOString().slice(0, 16);
});

// ==========================================
// API SERVER CONNECTION SETTINGS
// ==========================================
function initConnectionSettings() {
  const linkConfigureApi = document.getElementById('link-configure-api');
  const connectionSettingsPanel = document.getElementById('connection-settings-panel');
  const customApiUrlInput = document.getElementById('custom-api-url');
  const btnCancelApi = document.getElementById('btn-cancel-api');
  const btnSaveApi = document.getElementById('btn-save-api');

  const apiSettingsBtn = document.getElementById('api-settings-btn');
  const apiSettingsModal = document.getElementById('api-settings-modal');
  const modalApiUrlInput = document.getElementById('modal-api-url');
  const btnCloseApiModal = document.getElementById('btn-close-api-modal');
  const btnCancelApiModal = document.getElementById('btn-cancel-api-modal');
  const btnSaveApiModal = document.getElementById('btn-save-api-modal');

  // Set current base URL in forms
  customApiUrlInput.value = API_BASE_URL;
  modalApiUrlInput.value = API_BASE_URL;

  // Toggle panel inside Login Overlay
  linkConfigureApi.addEventListener('click', (e) => {
    e.preventDefault();
    connectionSettingsPanel.classList.toggle('hidden');
    customApiUrlInput.value = API_BASE_URL;
  });

  btnCancelApi.addEventListener('click', () => {
    connectionSettingsPanel.classList.add('hidden');
  });

  btnSaveApi.addEventListener('click', () => {
    let url = customApiUrlInput.value.trim();
    if (!url) {
      showToast('Please enter a valid server URL.', true);
      return;
    }
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    localStorage.setItem('api_base_url', url);
    API_BASE_URL = url;
    showToast(`API Server URL set to ${url}. Reconnecting...`);
    connectionSettingsPanel.classList.add('hidden');
    checkAuthStatus();
  });

  // Toggle Modal for authenticated users
  apiSettingsBtn.addEventListener('click', () => {
    modalApiUrlInput.value = API_BASE_URL;
    apiSettingsModal.classList.remove('hidden');
  });

  const closeApiModal = () => {
    apiSettingsModal.classList.add('hidden');
  };

  btnCloseApiModal.addEventListener('click', closeApiModal);
  btnCancelApiModal.addEventListener('click', closeApiModal);
  
  apiSettingsModal.addEventListener('click', (e) => {
    if (e.target === apiSettingsModal) {
      closeApiModal();
    }
  });

  btnSaveApiModal.addEventListener('click', () => {
    let url = modalApiUrlInput.value.trim();
    if (!url) {
      showToast('Please enter a valid server URL.', true);
      return;
    }
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    localStorage.setItem('api_base_url', url);
    API_BASE_URL = url;
    showToast(`API Server URL set to ${url}. Reconnecting...`);
    closeApiModal();
    checkAuthStatus();
  });
}

// ==========================================
// THEME & CUSTOM STYLE CONTROLS
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    const icon = themeToggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fa-solid fa-sun';
    }
  }

  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    
    // Update button icon
    const icon = themeToggleBtn.querySelector('i');
    if (icon) {
      icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    
    // Store preference
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    // If analytics charts are active, reload theme styling
    if (severityChartInstance || ratingsChartInstance) {
      loadAnalytics();
    }
    
    showToast(`Switched to ${isLight ? 'Light' : 'Dark'} Theme.`);
  });
}

// ==========================================
// TOAST NOTIFICATION HELPERS
// ==========================================
function showToast(message, isError = false) {
  toastMsg.textContent = message;
  const icon = document.getElementById('toast-icon');
  
  if (isError) {
    toast.style.borderColor = 'var(--color-error)';
    toast.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.2)';
    icon.className = 'fa-solid fa-circle-exclamation text-red';
  } else {
    toast.style.borderColor = 'var(--color-accent)';
    toast.style.boxShadow = 'var(--shadow-glow)';
    icon.className = 'fa-solid fa-circle-check text-green';
  }
  
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// ==========================================
// APP NAVIGATION
// ==========================================
function initNavigation() {
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      
      navButtons.forEach(b => b.classList.remove('active'));
      viewPanels.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const targetPanel = document.getElementById(target);
      if (targetPanel) targetPanel.classList.add('active');

      // Refresh listings/charts if entering panels
      if (target === 'register-view') {
        loadHistory();
      } else if (target === 'analytics-view') {
        loadAnalytics();
      }
    });
  });
}

// ==========================================
// FORM TAB CONTROLS
// ==========================================
function initFormTabs() {
  formTabs.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const tabId = trigger.getAttribute('data-tab');
      
      formTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      trigger.classList.add('active');
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

function switchFormTab(tabId) {
  const trigger = document.querySelector(`.tab-trigger[data-tab="${tabId}"]`);
  if (trigger) trigger.click();
}

function initCharacterCounter() {
  descTextarea.addEventListener('input', () => {
    const len = descTextarea.value.length;
    charCounterDesc.textContent = `${len} / 1000 characters`;
    if (len >= 950) {
      charCounterDesc.style.color = 'var(--color-error)';
    } else if (len >= 800) {
      charCounterDesc.style.color = 'var(--color-accent)';
    } else {
      charCounterDesc.style.color = 'var(--color-text-muted)';
    }
  });
}

// ==========================================
// TEMPLATE PRESETS LOAD & AUTOFILL
// ==========================================
async function loadPresets() {
  try {
    const res = await fetchAPI('/api/templates');
    if (!res.ok) throw new Error('Failed to load presets');
    const presets = await res.json();
    
    presetsContainer.innerHTML = '';
    presets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.type = 'button';
      btn.innerHTML = `<i class="fa-solid fa-file-invoice text-amber"></i> ${p.preset_name}`;
      btn.addEventListener('click', () => autofillPreset(p));
      presetsContainer.appendChild(btn);
    });
  } catch (err) {
    console.error('Presets loading error:', err);
    presetsContainer.innerHTML = `<p class="text-muted" style="font-size:0.8rem;">Could not load templates automatically.</p>`;
  }
}

function autofillPreset(preset) {
  // Fill inputs
  document.getElementById('incident_type').value = preset.incident_type;
  document.getElementById('raw_description').value = preset.raw_description;
  document.getElementById('immediate_actions').value = preset.immediate_actions || '';
  document.getElementById('weather_conditions').value = preset.weather_conditions || '';
  
  // Set severity radio button
  const rad = document.querySelector(`input[name="severity_level"][value="${preset.severity_level}"]`);
  if (rad) rad.checked = true;

  // Trigger character counter
  descTextarea.dispatchEvent(new Event('input'));
  
  // Navigate back to tab 2 to review filled details
  switchFormTab('tab-details');
  showToast(`Autofilled template: ${preset.preset_name}`);
}

// ==========================================
// FORM SUBMISSION & REPORT GENERATION
// ==========================================
incidentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Client-side validations
  if (!validateForm()) return;
  
  // Get payload
  const formData = new FormData(incidentForm);
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });

  await generateSafetyReport(payload);
});

function validateForm() {
  let isValid = true;
  const errors = {
    supervisor_name: !document.getElementById('supervisor_name').value.trim(),
    supervisor_role: !document.getElementById('supervisor_role').value.trim(),
    site_location: !document.getElementById('site_location').value.trim(),
    incident_timestamp: !document.getElementById('incident_timestamp').value,
    incident_type: !document.getElementById('incident_type').value,
    severity_level: !document.querySelector('input[name="severity_level"]:checked'),
    raw_description: document.getElementById('raw_description').value.trim().length < 15
  };

  // Toggle field error states
  for (const [field, isErr] of Object.entries(errors)) {
    const errSpan = document.getElementById(`err-${field}`);
    if (errSpan) {
      if (isErr) {
        errSpan.style.display = 'block';
        isValid = false;
        
        // Find which tab has the error and switch to it
        const tabContent = errSpan.closest('.tab-content');
        if (tabContent) {
          switchFormTab(tabContent.id);
        }
      } else {
        errSpan.style.display = 'none';
      }
    }
  }

  if (!isValid) {
    showToast('Please fill out all required fields correctly.', true);
  }
  return isValid;
}

async function generateSafetyReport(payload) {
  // UI transition to loading
  outputEmpty.classList.add('hidden');
  outputContent.classList.add('hidden');
  outputLoading.classList.remove('hidden');

  // Auto-scroll to results output panel on mobile/tablet viewports
  if (window.innerWidth <= 1024) {
    outputLoading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Animate mock progress steps
  const steps = [
    { text: 'Initializing site supervisor variables...', progress: 15 },
    { text: 'Constructing regulatory Safety Prompt context...', progress: 35 },
    { text: 'Consulting Google Gemini AI Engine...', progress: 55 },
    { text: 'Comparing incident details against Indian Standard safety codes...', progress: 75 },
    { text: 'Structuring root cause analysis & CAPA procedures...', progress: 90 },
    { text: 'Finalizing audit document layout...', progress: 100 }
  ];

  let currentStep = 0;
  const interval = setInterval(() => {
    if (currentStep < steps.length - 1) {
      loadingStepText.textContent = steps[currentStep].text;
      progressFill.style.width = `${steps[currentStep].progress}%`;
      currentStep++;
    }
  }, 1000);

  try {
    const res = await fetchAPI('/api/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    clearInterval(interval);
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Server error occurred during generation.');
    }

    const report = await res.json();
    
    // Complete progress fill
    progressFill.style.width = '100%';
    loadingStepText.textContent = 'Formatting report sheets...';

    setTimeout(() => {
      displayReport(report);
    }, 400);

  } catch (err) {
    clearInterval(interval);
    console.error('Report generation failed:', err);
    
    // Reset Loading State
    outputLoading.classList.add('hidden');
    outputEmpty.classList.remove('hidden');
    
    showToast(`Error: ${err.message}`, true);
  }
}

function displayReport(report) {
  // Update state
  currentReportId = report.id;
  currentReportMarkdown = report.generated_report_markdown;
  
  // Set system indicator depending on if it's mock or real Gemini response
  const indicator = document.querySelector('.system-status');
  if (report.is_mock) {
    indicator.className = 'system-status offline-mode';
    indicator.querySelector('.status-label').textContent = 'AI Offline (Mock Draft)';
    metaMockBadge.classList.remove('hidden');
  } else {
    indicator.className = 'system-status';
    indicator.querySelector('.status-label').textContent = 'AI Engine Connected';
    metaMockBadge.classList.add('hidden');
  }

  // Set meta values
  metaDuration.innerHTML = `<i class="fa-regular fa-clock"></i> Generated in ${(report.response_time_ms / 1000).toFixed(2)}s`;
  
  // Render Markdown using Marked.js
  reportBody.innerHTML = marked.parse(currentReportMarkdown);

  // Transition UI
  outputLoading.classList.add('hidden');
  outputContent.classList.remove('hidden');

  // Auto-scroll to report sheet on mobile/tablet viewports
  if (window.innerWidth <= 1024) {
    outputContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Reset ratings widget
  resetRatingsWidget();

  showToast('Safety incident report successfully compiled!');
}

// Reset Form button action
document.getElementById('form-reset-btn').addEventListener('click', () => {
  incidentForm.reset();
  descTextarea.dispatchEvent(new Event('input'));
  switchFormTab('tab-personnel');
  showToast('Workspace cleared.');
});

// ==========================================
// RATING & FEEDBACK MANAGEMENT
// ==========================================
function initStarRating() {
  starBtns.forEach(star => {
    star.addEventListener('mouseover', () => {
      const val = parseInt(star.getAttribute('data-value'));
      highlightStars(val);
    });

    star.addEventListener('mouseout', () => {
      highlightStars(activeRating);
    });

    star.addEventListener('click', () => {
      activeRating = parseInt(star.getAttribute('data-value'));
      highlightStars(activeRating);
      
      const labels = {
        1: 'Poor Quality (Critical Errors)',
        2: 'Needs Improvement (Missing sections)',
        3: 'Acceptable (Needs minor rewording)',
        4: 'Good (Accurate & Standard)',
        5: 'Outstanding (Audit-ready)'
      };
      
      ratingLabel.textContent = labels[activeRating] || 'Selected';
      feedbackCommentWrapper.classList.remove('hidden');
    });
  });

  btnSubmitFeedback.addEventListener('click', submitFeedbackData);
}

function highlightStars(count) {
  starBtns.forEach(star => {
    const val = parseInt(star.getAttribute('data-value'));
    if (val <= count) {
      star.className = 'fas fa-star star-btn';
    } else {
      star.className = 'far fa-star star-btn';
    }
  });
}

function resetRatingsWidget() {
  activeRating = 0;
  highlightStars(0);
  ratingLabel.textContent = 'Select star rating';
  feedbackComment.value = '';
  feedbackCommentWrapper.classList.add('hidden');
  feedbackSuccess.classList.add('hidden');
  feedbackPanel.classList.remove('hidden');
}

async function submitFeedbackData() {
  if (!currentReportId || activeRating === 0) return;

  try {
    const res = await fetchAPI('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        report_id: currentReportId,
        rating_stars: activeRating,
        comments: feedbackComment.value.trim()
      })
    });

    if (!res.ok) throw new Error('Failed to save rating');

    feedbackCommentWrapper.classList.add('hidden');
    feedbackSuccess.classList.remove('hidden');
    showToast('Quality feedback saved. Thank you!');
    
    // Refresh background metrics
    loadAnalytics();
  } catch (err) {
    showToast('Failed to submit rating: ' + err.message, true);
  }
}

// ==========================================
// ACTIONS: COPY, SHARE, REGENERATE, PDF
// ==========================================
btnCopyReport.addEventListener('click', () => {
  if (!currentReportMarkdown) return;
  navigator.clipboard.writeText(currentReportMarkdown)
    .then(() => showToast('Markdown report copied to clipboard.'))
    .catch(() => showToast('Failed to copy to clipboard.', true));
});

btnShareReport.addEventListener('click', () => {
  if (!currentReportId) return;
  const shareUrl = `${window.location.origin}/api/history/${currentReportId}`;
  navigator.clipboard.writeText(shareUrl)
    .then(() => showToast('Direct report access link copied to clipboard.'))
    .catch(() => showToast('Failed to copy link.', true));
});

btnRegenerateReport.addEventListener('click', () => {
  if (!currentReportId) return;
  // Get payload from form fields and trigger fresh generate
  const formData = new FormData(incidentForm);
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });
  
  if (validateForm()) {
    generateSafetyReport(payload);
    showToast('Regenerating report with current log values...');
  }
});

btnDownloadPdf.addEventListener('click', () => {
  window.print();
});

// ==========================================
// SAFETY REGISTER (HISTORY & SEARCH)
// ==========================================
async function loadHistory() {
  try {
    const res = await fetchAPI('/api/history');
    if (!res.ok) throw new Error('Failed to load incident registers');
    const reports = await res.json();
    
    renderHistoryTable(reports);
  } catch (err) {
    console.error('History load failure:', err);
    registerTableBody.innerHTML = `<tr><td colspan="7" class="text-red text-center">Failed to load safety register logs.</td></tr>`;
  }
}

function renderHistoryTable(reports) {
  const searchQuery = registerSearch.value.toLowerCase().trim();
  const severityFilter = filterSeverity.value;
  const classificationFilter = filterType.value;

  // Filter
  const filtered = reports.filter(r => {
    const matchesSearch = 
      r.supervisor_name.toLowerCase().includes(searchQuery) ||
      r.site_location.toLowerCase().includes(searchQuery) ||
      r.incident_type.toLowerCase().includes(searchQuery) ||
      r.id.toLowerCase().includes(searchQuery);

    const matchesSeverity = (severityFilter === 'ALL' || r.severity_level === severityFilter);
    const matchesType = (classificationFilter === 'ALL' || r.incident_type === classificationFilter);

    return matchesSearch && matchesSeverity && matchesType;
  });

  registerTableBody.innerHTML = '';
  
  if (filtered.length === 0) {
    registerTableBody.innerHTML = `<tr><td colspan="7" class="text-muted text-center">No reports match the active filters or search terms.</td></tr>`;
    return;
  }

  filtered.forEach(r => {
    const tr = document.createElement('tr');
    
    // Format timestamp
    const date = new Date(r.incident_timestamp).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const severityClass = `badge-${r.severity_level.toLowerCase()}`;
    const scoreBadge = r.rating_stars 
      ? `<span class="star-badge"><i class="fa-solid fa-star"></i> ${r.rating_stars}</span>` 
      : `<span class="text-muted" style="font-size:0.8rem;">Unrated</span>`;

    tr.innerHTML = `
      <td>${date}</td>
      <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.site_location}"><strong>${r.site_location}</strong></td>
      <td>${r.incident_type}</td>
      <td><span class="badge ${severityClass}">${r.severity_level}</span></td>
      <td>${r.supervisor_name}</td>
      <td>${scoreBadge}</td>
      <td>
        <button class="btn-view-report" onclick="openReportModal('${r.id}')">
          <i class="fa-regular fa-folder-open"></i> Open Sheet
        </button>
      </td>
    `;
    registerTableBody.appendChild(tr);
  });
}

// Add filter event listeners
registerSearch.addEventListener('input', () => {
  loadHistory();
});
filterSeverity.addEventListener('change', loadHistory);
filterType.addEventListener('change', loadHistory);

// ==========================================
// MODAL DRAWER FOR RECORD RETRIEVAL
// ==========================================
async function openReportModal(reportId) {
  try {
    const res = await fetchAPI(`/api/history/${reportId}`);
    if (!res.ok) throw new Error('Failed to retrieve safety sheet.');
    const report = await res.json();
    
    activeModalReportMarkdown = report.generated_report_markdown;
    
    // Set title & content
    modalReportTitle.innerHTML = `<i class="fa-solid fa-file-shield text-amber"></i> Audit Sheet: CR-INC-${new Date(report.incident_timestamp).getFullYear()}-${report.id.substring(4).toUpperCase()}`;
    
    // Render Markdown
    modalReportBody.innerHTML = marked.parse(activeModalReportMarkdown);
    
    // Show Modal
    reportModal.classList.remove('hidden');
  } catch (err) {
    showToast('Failed to load report sheet: ' + err.message, true);
  }
}

// Attach openReportModal function to window so dynamically created table buttons can trigger it
window.openReportModal = openReportModal;

// Close Modal
modalCloseBtn.addEventListener('click', () => {
  reportModal.classList.add('hidden');
});

reportModal.addEventListener('click', (e) => {
  if (e.target === reportModal) {
    reportModal.classList.add('hidden');
  }
});

// Modal Actions
modalBtnCopy.addEventListener('click', () => {
  if (!activeModalReportMarkdown) return;
  navigator.clipboard.writeText(activeModalReportMarkdown)
    .then(() => showToast('Markdown report copied from registry.'))
    .catch(() => showToast('Failed to copy.', true));
});

modalBtnPdf.addEventListener('click', () => {
  // Temporary copy modal sheet contents to active report sheet for print, then print
  const originalMarkdown = currentReportMarkdown;
  currentReportMarkdown = activeModalReportMarkdown;
  reportBody.innerHTML = marked.parse(activeModalReportMarkdown);
  
  // Hide modal temporarily for printing clean sheet
  reportModal.classList.add('hidden');
  
  setTimeout(() => {
    window.print();
    
    // Restore original
    currentReportMarkdown = originalMarkdown;
    if (originalMarkdown) {
      reportBody.innerHTML = marked.parse(originalMarkdown);
    }
    
    // Show modal back
    reportModal.classList.remove('hidden');
  }, 300);
});

// ==========================================
// ADMIN PANEL (METRICS & DYNAMIC CHARTS)
// ==========================================
async function loadAnalytics() {
  try {
    const res = await fetchAPI('/api/admin/analytics');
    if (!res.ok) throw new Error('Failed to load analytics metrics.');
    const data = await res.json();
    
    // Populate KPIs
    document.getElementById('kpi-total-reports').textContent = data.total_generations;
    document.getElementById('kpi-average-rating').textContent = data.average_rating 
      ? `${data.average_rating.toFixed(1)} / 5` 
      : '0.0 / 5';
    document.getElementById('kpi-response-time').textContent = `${data.average_response_time_ms} ms`;

    // Populate Location list
    const listContainer = document.getElementById('analytics-site-list');
    listContainer.innerHTML = '';
    
    if (data.top_locations.length === 0) {
      listContainer.innerHTML = `<li style="border-color: var(--color-text-muted);">No incident site data logged yet.</li>`;
    } else {
      data.top_locations.forEach(loc => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span><i class="fa-solid fa-industry text-amber"></i> ${loc.site_location}</span>
          <span class="site-count">${loc.count} Reports</span>
        `;
        listContainer.appendChild(li);
      });
    }

    // Render/Update Charts
    renderSeverityChart(data.severity_distribution);
    renderRatingsChart(data.rating_distribution);

  } catch (err) {
    console.error('Analytics load error:', err);
    showToast('Failed to load analytics data: ' + err.message, true);
  }
}

function renderSeverityChart(distribution) {
  const ctx = document.getElementById('chart-severity').getContext('2d');
  
  const labels = Object.keys(distribution);
  const data = Object.values(distribution);
  
  if (severityChartInstance) {
    severityChartInstance.destroy();
  }

  // Calculate theme-aware text colors
  const isLight = document.body.classList.contains('light-theme');
  const textColor = isLight ? '#475569' : '#94a3b8';

  // Custom theme colors matching design system
  const backgroundColors = [
    'rgba(16, 185, 129, 0.65)',  // Low - Green
    'rgba(59, 130, 246, 0.65)',  // Medium - Blue
    'rgba(245, 158, 11, 0.65)',  // High - Amber
    'rgba(239, 68, 68, 0.65)'    // Critical - Red
  ];
  const borderColors = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444'
  ];

  severityChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { family: 'Outfit', size: 12 }
          }
        }
      }
    }
  });
}

function renderRatingsChart(distribution) {
  const ctx = document.getElementById('chart-ratings').getContext('2d');
  
  const labels = Object.keys(distribution).map(k => `${k} Star${k > 1 ? 's' : ''}`);
  const data = Object.values(distribution);

  if (ratingsChartInstance) {
    ratingsChartInstance.destroy();
  }

  // Calculate theme-aware colors
  const isLight = document.body.classList.contains('light-theme');
  const textColor = isLight ? '#475569' : '#94a3b8';
  const gridColor = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)';

  ratingsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Quality Score Submissions',
        data: data,
        backgroundColor: 'rgba(37, 99, 235, 0.55)',
        borderColor: '#2563eb',
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: textColor,
            stepSize: 1,
            font: { family: 'Outfit' }
          },
          grid: { color: gridColor }
        },
        x: {
          ticks: {
            color: textColor,
            font: { family: 'Outfit' }
          },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}
