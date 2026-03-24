/**
 * Global Cargo Shipping Company — Frontend Configuration
 * Auto-detects local vs production environment.
 */
// Detect local development:
// - hostname is localhost/127.0.0.1 (Live Server, node static server, etc.)
// - protocol is file:// (opened directly in browser — no HTTP server)
// - hostname is empty string (also file:// in some browsers)
// - running on a non-standard port like 5500 (VS Code Live Server)
const _isLocal = (
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname === '' ||
  location.protocol === 'file:' ||
  (location.port !== '' && location.port !== '80' && location.port !== '443' &&
   !location.hostname.includes('.'))
);
const CONFIG = {
  API_BASE_URL: _isLocal ? 'http://localhost:5000/api' : 'https://globalcargo-gcsc.onrender.com/api',
  SOCKET_URL: _isLocal ? 'http://localhost:5000' : 'https://globalcargo-gcsc.onrender.com',
  APP_NAME: 'Global Cargo Shipping Company',
  VERSION: '5.1.0'
};

/* ── API helper ─────────────────────────────────────────────────────────────── */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('gcsc_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json();

  if (response.status === 401) {
    removeToken();
    // Redirect to login — works from any depth
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    const prefix = depth > 1 ? '../' : '';
    window.location.href = prefix + 'admin/login.html';
    return;
  }
  if (!response.ok) throw new APIError(data.message || 'Request failed', response.status, data);
  return data;
}

class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/* ── Token helpers ──────────────────────────────────────────────────────────── */
function getToken() { return localStorage.getItem('gcsc_token'); }
function setToken(t) { localStorage.setItem('gcsc_token', t); }
function removeToken() {
  localStorage.removeItem('gcsc_token');
  localStorage.removeItem('gcsc_admin');
}
function getAdmin() {
  try { return JSON.parse(localStorage.getItem('gcsc_admin') || 'null'); } catch { return null; }
}
function setAdmin(a) { localStorage.setItem('gcsc_admin', JSON.stringify(a)); }

/* ── Date formatters ────────────────────────────────────────────────────────── */
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatRelativeTime(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

/* ── Status config ──────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  'Pending': { color: '#f59e0b', bg: 'rgba(245,158,11,.12)', icon: '⏳', label: 'Pending' },
  'Processing': { color: '#3b82f6', bg: 'rgba(59,130,246,.12)', icon: '⚙️', label: 'Processing' },
  'In Transit': { color: '#D40511', bg: 'rgba(212,5,17,.08)', icon: '🚚', label: 'In Transit' },
  'Out for Delivery': { color: '#f97316', bg: 'rgba(249,115,22,.12)', icon: '📦', label: 'Out for Delivery' },
  'Delivered': { color: '#16a34a', bg: 'rgba(22,163,74,.12)', icon: '✅', label: 'Delivered' },
  'Exception': { color: '#ef4444', bg: 'rgba(239,68,68,.12)', icon: '⚠️', label: 'Exception' },
  'Returned': { color: '#94a3b8', bg: 'rgba(148,163,184,.12)', icon: '↩️', label: 'Returned' },
  'On Hold': { color: '#fb923c', bg: 'rgba(251,146,60,.12)', icon: '⏸️', label: 'On Hold' },
};
function getStatusConfig(s) { return STATUS_CONFIG[s] || STATUS_CONFIG['Pending']; }

/* ── Toast ──────────────────────────────────────────────────────────────────── */
function showToast(message, type = 'success', duration = 4000) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'i'}</span><span class="toast-message">${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── Button loading state ───────────────────────────────────────────────────── */
function setLoading(btn, isLoading, originalText = null) {
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Loading…';
    btn.disabled = true;
  } else {
    btn.textContent = originalText || btn.dataset.originalText;
    btn.disabled = false;
  }
}

/* ── Expose globally ────────────────────────────────────────────────────────── */
window.CONFIG = CONFIG;
window.apiRequest = apiRequest;
window.APIError = APIError;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.getAdmin = getAdmin;
window.setAdmin = setAdmin;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatRelativeTime = formatRelativeTime;
window.getStatusConfig = getStatusConfig;
window.showToast = showToast;
window.setLoading = setLoading;
