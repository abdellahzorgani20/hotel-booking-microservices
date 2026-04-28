document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  // L'admin n'a pas accès à "Mes Réservations"
  if (isAdmin()) {
    window.location.href = '/admin.html';
    return;
  }
  updateNav();
  await loadBookings();
});

async function loadBookings() {
  const container = document.getElementById('bookings-container');
  container.innerHTML = `<tr><td colspan="7" class="text-center py-4">
    <div class="spinner-border text-primary" role="status"></div>
  </td></tr>`;

  try {
    const res = await api(`${CONFIG.BOOKING_URL}/bookings/`);
    if (!res.ok) throw new Error('Impossible de charger les réservations');
    const data = await res.json();
    const userId = getUser().id;
    const bookings = (data.results || data);

    if (!bookings.length) {
      container.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">
        <i class="bi bi-calendar-x fs-2 d-block mb-2"></i>Aucune réservation pour l'instant.
        <a href="/hotels.html" class="btn btn-sm btn-primary mt-2">Parcourir les hôtels</a>
      </td></tr>`;
      return;
    }

    container.innerHTML = bookings.map(b => `
      <tr>
        <td><strong>#${b.id}</strong></td>
        <td>
          <div class="fw-semibold">${b.hotel_name}</div>
          <small class="text-muted">Chambre ${b.room_number} · ${b.room_type}</small>
        </td>
        <td>${formatDate(b.check_in)}</td>
        <td>${formatDate(b.check_out)}</td>
        <td>${b.nights} nuits · ${b.guests} voyageurs</td>
        <td class="fw-bold text-success">${formatMoney(b.total_price)}</td>
        <td>
          <span class="badge bg-${statusColor(b.status)}">${translateStatus(b.status)}</span>
          ${b.status === 'pending' || b.status === 'accepted'
        ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="cancelBooking(${b.id}, this)">Annuler</button>`
        : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">
      ${err.message}. Service de réservation indisponible.
    </td></tr>`;
  }
}

async function cancelBooking(id, btn) {
  if (!confirm('Annuler cette réservation ?')) return;
  btn.disabled = true;
  btn.textContent = 'Annulation...';
  try {
    const res = await api(`${CONFIG.BOOKING_URL}/bookings/${id}/cancel/`, { method: 'POST' });
    if (res.ok) {
      showAlert('alert-container', 'Réservation annulée.', 'warning');
      await loadBookings();
    } else {
      const data = await res.json();
      showAlert('alert-container', data.error || "Échec de l'annulation.");
      btn.disabled = false;
      btn.textContent = 'Annuler';
    }
  } catch {
    showAlert('alert-container', 'La requête a échoué.');
    btn.disabled = false;
    btn.textContent = 'Annuler';
  }
}