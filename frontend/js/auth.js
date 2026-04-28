document.addEventListener('DOMContentLoaded', () => {
  updateNav();
  if (isLoggedIn()) { window.location.href = '/hotels.html'; return; }

  function setBusy(btn, busy, idleHTML) {
    btn.disabled = busy;
    btn.innerHTML = busy ? '<span class="spinner-border spinner-border-sm me-2"></span>...' : idleHTML;
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = loginForm.querySelector('[type=submit]');
      const idle = btn.innerHTML;
      setBusy(btn, true);
      try {
        const res = await fetch(`${CONFIG.AUTH_URL}/login/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginForm.email.value.trim(), password: loginForm.password.value }),
        });
        const data = await res.json();
        if (res.ok) { setTokens(data.access, data.refresh, data.user); window.location.href = '/hotels.html'; }
        else showAlert('alert-container', data.detail || data.non_field_errors?.[0] || 'Identifiants invalides.');
      } catch { showAlert('alert-container', 'Service d\'authentification indisponible.'); }
      setBusy(btn, false, idle);
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = registerForm.querySelector('[type=submit]');
      const idle = btn.innerHTML;
      setBusy(btn, true);
      const body = {
        username: registerForm.username.value.trim(),
        email: registerForm.email.value.trim(),
        password: registerForm.password.value,
        password2: registerForm.password2.value,
      };
      try {
        const res = await fetch(`${CONFIG.AUTH_URL}/register/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok) {
          setTokens(data.access, data.refresh, data.user);
          showAlert('alert-container', 'Compte créé ! Redirection...', 'success');
          setTimeout(() => window.location.href = '/hotels.html', 1200);
        } else {
          showAlert('alert-container', Object.values(data).flat().join(' ') || 'Échec de l\'inscription.');
          setBusy(btn, false, idle);
        }
      } catch {
        showAlert('alert-container', 'Erreur réseau.');
        setBusy(btn, false, idle);
      }
    });
  }
});