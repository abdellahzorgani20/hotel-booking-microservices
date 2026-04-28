const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const CONFIG = {
  AUTH_URL: IS_LOCAL ? 'http://localhost/api/auth' : 'https://auth-service-no6p.onrender.com/api/auth',
  HOTEL_URL: IS_LOCAL ? 'http://localhost/api' : 'https://hotel-service-f6mq.onrender.com/api',
  BOOKING_URL: IS_LOCAL ? 'http://localhost/api' : 'https://booking-service-vvfy.onrender.com/api',
};

// Fonctions pour les tokens d'authentification
const getToken = () => localStorage.getItem('access_token');
const getRefreshToken = () => localStorage.getItem('refresh_token');
const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');
const isLoggedIn = () => !!getToken();
const isAdmin = () => getUser()?.role === 'admin';

function setTokens(access, refresh, user) {
  if (access) localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
  if (user) localStorage.setItem('user', JSON.stringify(user));
}
function clearTokens() {
  ['access_token', 'refresh_token', 'user'].forEach(k => localStorage.removeItem(k));
}

// Fonction d'appel API
async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && getRefreshToken()) {
    const r = await fetch(`${CONFIG.AUTH_URL}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: getRefreshToken() }),
    });
    if (r.ok) {
      const d = await r.json();
      setTokens(d.access, d.refresh, null);
      headers['Authorization'] = `Bearer ${d.access}`;
      res = await fetch(url, { ...options, headers });
    } else {
      clearTokens();
      window.location.href = '/login.html';
      return null;
    }
  }
  return res;
}

// Fonctions pour les statuts
function statusColor(s) {
  return {
    accepted: 'success',
    cancelled: 'danger',
    pending: 'warning',
    refused: 'secondary',
  }[s] ?? 'secondary';
}
function translateStatus(s) {
  return {
    accepted: 'Accepté',
    cancelled: 'Annulée',
    pending: 'En attente',
    refused: 'Refusé',
  }[s] ?? s;
}

// Navbar
document.body.insertAdjacentHTML('afterbegin', `
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm sticky-top">
    <div class="container">
      <a class="navbar-brand fw-bold" href="/index.html"><i class="bi bi-building-fill me-2"></i>HotelBook</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="nav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item"><a class="nav-link" href="/hotels.html"><i class="bi bi-search me-1"></i>Hôtels</a></li>
          <li class="nav-item d-none" id="nav-bookings-item">
            <a class="nav-link" href="/bookings.html"><i class="bi bi-calendar-check me-1"></i>Mes Réservations</a>
          </li>
          <li class="nav-item d-none" id="nav-admin-item">
            <a class="nav-link" href="/admin.html"><i class="bi bi-gear me-1"></i>Administration</a>
          </li>
        </ul>
        <ul class="navbar-nav" id="nav-right">
          <li class="nav-item"><a class="nav-link" href="/login.html" id="nav-login"><i class="bi bi-person-circle me-1"></i>Connexion</a></li>
        </ul>
      </div>
    </div>
  </nav>
  <div id="main-alert" class="container mt-3"></div>
`);

function updateNav() {
  const user = getUser();
  const navLogin = document.getElementById('nav-login');
  const navAdminItem = document.getElementById('nav-admin-item');
  const navBookingsItem = document.getElementById('nav-bookings-item');

  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
    if ((link.getAttribute('href') || '').split('/').pop() === currentPage)
      link.classList.add('active-page');
  });

  document.querySelectorAll('.injected-user-nav').forEach(el => el.remove());

  if (user) {
    navLogin?.closest('li')?.style.setProperty('display', 'none');
    // "Mes Réservations" uniquement pour les utilisateurs non-admin
    navBookingsItem.classList.toggle('d-none', isAdmin());
    // "Administration" uniquement pour l'admin
    navAdminItem.classList.toggle('d-none', !isAdmin());
    document.getElementById('nav-right').insertAdjacentHTML('beforeend', `
      <li class="nav-item injected-user-nav">
        <a class="nav-link" href="/profile.html"><i class="bi bi-person-circle me-1"></i>Profile</a>
      </li>
      <li class="nav-item injected-user-nav">
        <a class="nav-link" href="#" onclick="logout(); return false;"><i class="bi bi-box-arrow-right me-1"></i>Déconnexion</a>
      </li>
    `);
  } else {
    navLogin?.closest('li')?.style.removeProperty('display');
    navBookingsItem.classList.add('d-none');
    navAdminItem.classList.add('d-none');
  }
}

function requireAuth() {
  if (!isLoggedIn()) { window.location.href = '/login.html'; return false; }
  return true;
}

function logout() {
  const token = getRefreshToken();
  if (token) {
    fetch(`${CONFIG.AUTH_URL}/logout/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ refresh: token }),
    }).catch(() => { });
  }
  clearTokens();
  window.location.href = '/login.html';
}

// Fonctions d'interface utilisateur
function showAlert(containerId, message, type = 'danger') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

function formatMoney(amount) {
  return parseFloat(amount || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}