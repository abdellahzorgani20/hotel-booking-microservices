document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  if (!isAdmin()) { window.location.href = '/hotels.html'; return; }
  updateNav();
  await Promise.all([loadStats(), loadAdminBookings(), loadAdminHotels(), loadAdminUsers()]);

  // Changement de tabs
  document.querySelectorAll('#admin-tabs .nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#admin-tabs .nav-link').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('d-none'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.remove('d-none');
    });
  });

  // Formulaire hôtel (add + modify)
  document.getElementById('hotel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('hotel-form-id').value;
    const body = Object.fromEntries(new FormData(e.target));
    body.stars = parseInt(body.stars);
    const btn = document.getElementById('hotel-form-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Enregistrement...';

    const res = await api(
      id ? `${CONFIG.HOTEL_URL}/hotels/${id}/` : `${CONFIG.HOTEL_URL}/hotels/`,
      { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) }
    );
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-save me-1"></i>Enregistrer';

    if (res.ok) {
      bootstrap.Modal.getInstance(document.getElementById('hotel-modal')).hide();
      e.target.reset();
      await loadAdminHotels();
      showAlert('alert-container', id ? 'Hôtel modifié avec succès !' : 'Hôtel ajouté avec succès !', 'success');
    } else {
      showAlert('hotel-form-alert', JSON.stringify(await res.json()));
    }
  });

  // Formulaire chambre (add + modify)
  document.getElementById('room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomId = document.getElementById('room-form-id').value;
    const hotelId = document.getElementById('rooms-hotel-id').value;
    const btn = document.getElementById('room-form-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Enregistrement...';

    const body = {
      number: document.getElementById('rf-number').value.trim(),
      room_type: document.getElementById('rf-type').value,
      price_per_night: parseFloat(document.getElementById('rf-price').value),
      capacity: parseInt(document.getElementById('rf-capacity').value),
      description: document.getElementById('rf-description').value || '',
      is_available: document.getElementById('rf-available').checked,
    };

    try {
      const res = await api(
        roomId ? `${CONFIG.HOTEL_URL}/rooms/${roomId}/` : `${CONFIG.HOTEL_URL}/hotels/${hotelId}/rooms/`,
        { method: roomId ? 'PATCH' : 'POST', body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (res.ok) {
        showAlert('rooms-alert', `Chambre ${data.number} ${roomId ? 'modifiée' : 'ajoutée'} avec succès !`, 'success');
        resetRoomForm();
        await Promise.all([loadRooms(hotelId), loadAdminHotels()]);
      } else {
        const msg = Object.entries(data).map(([k, v]) => `<strong>${k}:</strong> ${[].concat(v).join(', ')}`).join('<br>');
        showAlert('rooms-alert', msg || 'Échec de l\'opération.');
      }
    } catch (err) {
      showAlert('rooms-alert', 'Requête échouée : ' + err.message);
    }
    btn.disabled = false;
    btn.innerHTML = roomId
      ? '<i class="bi bi-save me-1"></i>Enregistrer'
      : '<i class="bi bi-plus-lg me-1"></i>Ajouter';
  });
});

// Statistiques

async function loadStats() {
  try {
    const res = await api(`${CONFIG.BOOKING_URL}/bookings/stats/`);
    if (!res.ok) return;
    const d = await res.json();
    document.getElementById('stat-total').textContent = d.total;
    document.getElementById('stat-confirmed').textContent = d.accepted ?? d.confirmed ?? 0;
    document.getElementById('stat-pending').textContent = d.pending ?? 0;
    document.getElementById('stat-cancelled').textContent = d.cancelled;
    document.getElementById('stat-refused').textContent = d.refused ?? 0;
    document.getElementById('stat-revenue').textContent = formatMoney(d.revenue);
  } catch (_) { }
}

// Réservations

async function loadAdminBookings() {
  const tbody = document.getElementById('admin-bookings-body');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>`;
  try {
    const res = await api(`${CONFIG.BOOKING_URL}/bookings/`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const bookings = data.results || data;

    if (!bookings.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Aucune réservation.</td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td>${b.id}</td>
        <td><div>${b.user_name}</div><small class="text-muted">${b.user_email}</small></td>
        <td><div>${b.hotel_name}</div><small>Chambre ${b.room_number}</small></td>
        <td>${b.check_in} → ${b.check_out}</td>
        <td>${formatMoney(b.total_price)}</td>
        <td><span class="badge bg-${statusColor(b.status)}">${translateStatus(b.status)}</span></td>
        <td>
          ${b.status === 'pending' ? `
            <div class="d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-success" onclick="acceptBooking(${b.id}, this)"
                title="Accepter">
                <i class="bi bi-check-lg me-1"></i>Accepter
              </button>
              <button class="btn btn-sm btn-danger" onclick="refuseBooking(${b.id}, this)"
                title="Refuser">
                <i class="bi bi-x-lg me-1"></i>Refuser
              </button>
            </div>` : `<span class="text-muted small">—</span>`}
        </td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="7" class="text-danger text-center">Impossible de charger les réservations.</td></tr>';
  }
}

async function acceptBooking(id, btn) {
  if (!confirm('Accepter cette réservation ?')) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  try {
    const res = await api(`${CONFIG.BOOKING_URL}/bookings/${id}/accept/`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showAlert('alert-container', `Réservation #${id} acceptée. Un email a été envoyé au client.`, 'success');
      await Promise.all([loadAdminBookings(), loadStats()]);
    } else {
      showAlert('alert-container', data.error || 'Impossible d\'accepter la réservation.');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Accepter';
    }
  } catch {
    showAlert('alert-container', 'Requête échouée.');
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Accepter';
  }
}

async function refuseBooking(id, btn) {
  if (!confirm('Refuser cette réservation ?')) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  try {
    const res = await api(`${CONFIG.BOOKING_URL}/bookings/${id}/refuse/`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showAlert('alert-container', `Réservation #${id} refusée. Un email a été envoyé au client.`, 'warning');
      await Promise.all([loadAdminBookings(), loadStats()]);
    } else {
      showAlert('alert-container', data.error || 'Impossible de refuser la réservation.');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-x-lg me-1"></i>Refuser';
    }
  } catch {
    showAlert('alert-container', 'Requête échouée.');
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-x-lg me-1"></i>Refuser';
  }
}

// Hôtels

async function loadAdminHotels() {
  const container = document.getElementById('admin-hotels-container');
  try {
    const res = await fetch(`${CONFIG.HOTEL_URL}/hotels/?page_size=100`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    container.innerHTML = (data.results || data).map(h => `
      <div class="col-sm-6 col-lg-4">
        <div class="card shadow-sm mb-3 h-100 hotel-card" style="background:#f4f5f7">
          <img src="${h.image_url || 'https://placehold.co/400x180/4a5568/white?text=' + encodeURIComponent(h.name)}"
               class="card-img-top" alt="${h.name}" style="height:180px;object-fit:cover">
          <div class="card-body py-2" style="background:#f4f5f7">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <strong>${h.name}</strong>
                <div class="text-muted small">${h.city}, ${h.country} · ${'★'.repeat(h.stars)}</div>
                <div class="mt-1">
                  <span class="badge bg-light text-dark border me-1"><i class="bi bi-door-open me-1"></i>${h.available_rooms_count ?? '?'} disponibles</span>
                  <span class="badge bg-light text-secondary border">${h.rooms_count ?? '?'} total</span>
                </div>
              </div>
              <div class="d-flex flex-column gap-1">
                <button class="btn btn-outline-primary btn-sm" onclick="openManageRooms(${h.id}, '${h.name.replace(/'/g, "\\'")}')">
                  <i class="bi bi-door-open"></i> Chambres
                </button>
                <button class="btn btn-outline-secondary btn-sm" onclick="openHotelModal(${h.id})">
                  <i class="bi bi-pencil"></i> Modifier
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteHotel(${h.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`).join('');
  } catch {
    container.innerHTML = '<div class="col-12"><div class="alert alert-warning">Impossible de charger les hôtels.</div></div>';
  }
}

async function deleteHotel(id) {
  if (!confirm('Supprimer cet hôtel définitivement ?')) return;
  const res = await api(`${CONFIG.HOTEL_URL}/hotels/${id}/`, { method: 'DELETE' });
  if (res.ok || res.status === 204) {
    await loadAdminHotels();
    showAlert('alert-container', 'Hôtel supprimé.', 'warning');
  } else {
    showAlert('alert-container', 'Impossible de supprimer cet hôtel.');
  }
}

async function openHotelModal(id = null) {
  document.getElementById('hotel-form-id').value = id || '';
  document.getElementById('hotel-form-alert').innerHTML = '';
  document.getElementById('hotel-form').reset();
  document.getElementById('hotel-modal-title').innerHTML = id
    ? '<i class="bi bi-pencil-square me-2"></i>Modifier l\'hôtel'
    : '<i class="bi bi-building-add me-2"></i>Ajouter un hôtel';

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('hotel-modal'));
  modal.show();
  if (!id) return;

  const form = document.getElementById('hotel-form');
  form.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
  try {
    const res = await fetch(`${CONFIG.HOTEL_URL}/hotels/${id}/`);
    if (!res.ok) throw new Error('Hôtel introuvable');
    const h = await res.json();
    document.getElementById('hf-name').value = h.name || '';
    document.getElementById('hf-city').value = h.city || '';
    document.getElementById('hf-country').value = h.country || '';
    document.getElementById('hf-address').value = h.address || '';
    document.getElementById('hf-stars').value = h.stars ?? 3;
    document.getElementById('hf-image').value = h.image_url || '';
    document.getElementById('hf-description').value = h.description || '';
  } catch (err) {
    document.getElementById('hotel-form-alert').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  } finally {
    form.querySelectorAll('input, select, textarea').forEach(el => el.disabled = false);
  }
}

// Utilisateurs

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-body');
  try {
    const res = await api(`${CONFIG.AUTH_URL}/users/`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    tbody.innerHTML = (data.results || data).map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td>${u.email}</td>
        <td><span class="badge bg-${u.role === 'admin' ? 'danger' : 'primary'}">${u.role}</span></td>
        <td>${formatDate(u.date_joined)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">Aucun utilisateur.</td></tr>';
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Impossible de charger les utilisateurs.</td></tr>';
  }
}

// Chambres

async function openManageRooms(hotelId, hotelName) {
  document.getElementById('rooms-hotel-id').value = hotelId;
  document.getElementById('rooms-hotel-name').textContent = hotelName;
  document.getElementById('rooms-alert').innerHTML = '';
  resetRoomForm();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('manage-rooms-modal')).show();
  await loadRooms(hotelId);
}

async function loadRooms(hotelId) {
  const container = document.getElementById('rooms-list');
  container.innerHTML = `<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;
  try {
    const res = await fetch(`${CONFIG.HOTEL_URL}/hotels/${hotelId}/rooms/`);
    if (!res.ok) throw new Error('Impossible de charger les chambres');
    renderRoomsList(await res.json());
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function renderRoomsList(rooms) {
  const container = document.getElementById('rooms-list');
  if (!rooms.length) {
    container.innerHTML = `<p class="text-muted text-center py-3">
      <i class="bi bi-door-closed fs-3 d-block mb-1"></i>Aucune chambre. Ajoutez-en une ci-dessus.
    </p>`;
    return;
  }
  const typeColors = { single: 'info', double: 'primary', twin: 'secondary', suite: 'warning', deluxe: 'success', family: 'danger' };
  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm table-hover align-middle mb-0">
        <thead class="table-light">
          <tr><th>Chambre</th><th>Type</th><th>Capacité</th><th>Prix/Nuit</th><th>Disponible</th><th></th></tr>
        </thead>
        <tbody>
          ${rooms.map(r => `
            <tr id="room-row-${r.id}">
              <td><strong>${r.number}</strong></td>
              <td><span class="badge bg-${typeColors[r.room_type] || 'secondary'}">${r.room_type}</span></td>
              <td><i class="bi bi-people me-1 text-muted"></i>${r.capacity}</td>
              <td class="fw-semibold text-success">${formatMoney(r.price_per_night)}</td>
              <td>
                <div class="form-check form-switch mb-0">
                  <input class="form-check-input" type="checkbox" role="switch"
                    ${r.is_available ? 'checked' : ''}
                    onchange="toggleRoomAvailability(${r.id}, this)">
                </div>
              </td>
              <td>
                <div class="d-flex gap-1">
                  <button class="btn btn-outline-secondary btn-sm" onclick="openEditRoom(${r.id})" title="Modifier"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-outline-danger btn-sm" onclick="deleteRoom(${r.id}, this)" title="Supprimer"><i class="bi bi-trash"></i></button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function openEditRoom(roomId) {
  const form = document.getElementById('room-form');
  form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
  document.getElementById('room-form-id').value = roomId;
  document.getElementById('room-form-mode-label').textContent = 'Modifier la chambre';
  document.getElementById('room-form-card').className = 'card mb-3 border-warning';
  document.getElementById('room-form-cancel').classList.remove('d-none');
  document.getElementById('room-form-btn').innerHTML = '<i class="bi bi-save me-1"></i>Enregistrer';
  document.getElementById('room-form-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const res = await fetch(`${CONFIG.HOTEL_URL}/rooms/${roomId}/`);
    if (!res.ok) throw new Error('Chambre introuvable');
    const r = await res.json();
    document.getElementById('rf-number').value = r.number || '';
    document.getElementById('rf-type').value = r.room_type || 'double';
    document.getElementById('rf-price').value = r.price_per_night || '';
    document.getElementById('rf-capacity').value = r.capacity || 2;
    document.getElementById('rf-description').value = r.description || '';
    document.getElementById('rf-available').checked = r.is_available;
    document.querySelectorAll('tr[id^="room-row-"]').forEach(row => row.classList.remove('table-warning'));
    document.getElementById(`room-row-${roomId}`)?.classList.add('table-warning');
  } catch (err) {
    showAlert('rooms-alert', err.message);
    resetRoomForm();
  } finally {
    form.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
  }
}

function resetRoomForm() {
  document.getElementById('room-form-id').value = '';
  document.getElementById('room-form').reset();
  document.getElementById('rf-available').checked = true;
  document.getElementById('room-form-mode-label').textContent = 'Ajouter une chambre';
  document.getElementById('room-form-card').className = 'card mb-3 border-primary';
  document.getElementById('room-form-cancel').classList.add('d-none');
  document.getElementById('room-form-btn').innerHTML = '<i class="bi bi-plus-lg me-1"></i>Ajouter';
  document.querySelectorAll('tr[id^="room-row-"]').forEach(row => row.classList.remove('table-warning'));
}

async function toggleRoomAvailability(roomId, checkbox) {
  try {
    const res = await api(`${CONFIG.HOTEL_URL}/rooms/${roomId}/`, {
      method: 'PATCH', body: JSON.stringify({ is_available: checkbox.checked }),
    });
    if (!res.ok) { checkbox.checked = !checkbox.checked; showAlert('rooms-alert', 'Échec de la mise à jour.'); }
  } catch {
    checkbox.checked = !checkbox.checked; showAlert('rooms-alert', 'Requête échouée.');
  }
}

async function deleteRoom(roomId, btn) {
  if (!confirm('Supprimer cette chambre définitivement ?')) return;
  btn.disabled = true;
  const hotelId = document.getElementById('rooms-hotel-id').value;
  try {
    const res = await api(`${CONFIG.HOTEL_URL}/rooms/${roomId}/`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      showAlert('rooms-alert', 'Chambre supprimée.', 'warning');
      resetRoomForm();
      await Promise.all([loadRooms(hotelId), loadAdminHotels()]);
    } else {
      showAlert('rooms-alert', 'Échec de la suppression.');
      btn.disabled = false;
    }
  } catch {
    showAlert('rooms-alert', 'Requête échouée.');
    btn.disabled = false;
  }
}