// Gestion du profil utilisateur
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  updateNav();
  await loadProfile();
  initPasswordForm();
  initTogglePasswordButtons();
  initStrengthMeter();
});

// Chargement et MAJ du profil

async function loadProfile() {
  try {
    const res = await api(`${CONFIG.AUTH_URL}/profile/`);
    if (!res || !res.ok) throw new Error('Impossible de charger le profil.');
    const user = await res.json();
    populateProfileForm(user);
  } catch (err) {
    showAlert('profile-alert', err.message);
    document.getElementById('profile-skeleton').style.display = 'none';
  }
}

function populateProfileForm(user) {
  document.getElementById('profile-skeleton').style.display = 'none';
  document.getElementById('profile-form').style.display = '';

  document.getElementById('profile-username').value = user.username || '';
  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-joined').textContent =
    user.date_joined ? formatDate(user.date_joined) : '—';

  const badge = document.getElementById('profile-role-badge');
  badge.textContent = user.role === 'admin' ? 'Administrateur' : 'Client';
  badge.className = `badge fs-6 bg-${user.role === 'admin' ? 'danger' : 'primary'}`;
}

document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('profile-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enregistrement...';

  const body = {
    username: document.getElementById('profile-username').value.trim(),
    email: document.getElementById('profile-email').value.trim(),
  };

  try {
    const res = await api(`${CONFIG.AUTH_URL}/profile/`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (res.ok) {
      // Update stored user so the navbar reflects the new username
      const stored = getUser();
      setTokens(null, null, { ...stored, ...data });
      updateNav();
      showAlert('profile-alert', 'Profil mis à jour avec succès.', 'success');
    } else {
      const msg = Object.values(data).flat().join(' ');
      showAlert('profile-alert', msg || 'Erreur lors de la mise à jour.');
    }
  } catch {
    showAlert('profile-alert', 'Erreur réseau. Vérifiez que le service d\'authentification est actif.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-floppy me-1"></i>Enregistrer les modifications';
  }
});

// Changement de mot de passe

function initPasswordForm() {
  document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPw = document.getElementById('new-password').value;
    const newPw2 = document.getElementById('new-password2').value;

    if (newPw !== newPw2) {
      showAlert('password-alert', 'Les nouveaux mots de passe ne correspondent pas.');
      return;
    }

    const btn = document.getElementById('pw-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Mise à jour...';

    const body = {
      old_password: document.getElementById('old-password').value,
      new_password: newPw,
    };

    try {
      const res = await api(`${CONFIG.AUTH_URL}/profile/change-password/`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        showAlert('password-alert', 'Mot de passe mis à jour. Reconnectez-vous si nécessaire.', 'success');
        document.getElementById('password-form').reset();
        resetStrengthMeter();
      } else {
        const msg = data.detail || Object.values(data).flat().join(' ');
        showAlert('password-alert', msg || 'Échec de la mise à jour.');
      }
    } catch {
      showAlert('password-alert', 'Erreur réseau. Vérifiez que le service d\'authentification est actif.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-lock me-1"></i>Mettre à jour le mot de passe';
    }
  });
}

// Afficher / masquer les mots de passe

function initTogglePasswordButtons() {
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
      }
    });
  });
}

// Jauge de force du mot de passe

function initStrengthMeter() {
  document.getElementById('new-password')?.addEventListener('input', function () {
    const score = passwordStrength(this.value);
    const bar = document.getElementById('strength-bar');
    const label = document.getElementById('strength-label');

    const levels = [
      { pct: 0, cls: '', text: '—' },
      { pct: 25, cls: 'bg-danger', text: 'Faible' },
      { pct: 50, cls: 'bg-warning', text: 'Moyen' },
      { pct: 75, cls: 'bg-info', text: 'Bon' },
      { pct: 100, cls: 'bg-success', text: 'Excellent' },
    ];
    const lvl = levels[score];
    bar.style.width = lvl.pct + '%';
    bar.className = `progress-bar ${lvl.cls}`;
    label.textContent = lvl.text;
  });
}

function passwordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function resetStrengthMeter() {
  const bar = document.getElementById('strength-bar');
  const label = document.getElementById('strength-label');
  bar.style.width = '0%';
  bar.className = 'progress-bar';
  label.textContent = '—';
}