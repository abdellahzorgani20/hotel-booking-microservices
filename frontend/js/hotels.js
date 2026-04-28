let currentPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
  updateNav();
  await loadHotels();

  document.getElementById('search-input')?.addEventListener('input', debounce(() => loadHotels(1), 300));
  document.getElementById('filter-city')?.addEventListener('change', () => loadHotels(1));
  document.getElementById('filter-stars')?.addEventListener('change', () => loadHotels(1));

  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-book');
    if (btn) openBooking(
      +btn.dataset.hotelId, btn.dataset.hotelName,
      +btn.dataset.roomId, btn.dataset.roomNumber,
      btn.dataset.roomType, +btn.dataset.price
    );
  });

  document.getElementById('booking-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Réservation en cours...';

    const body = {
      hotel_id: +document.getElementById('book-hotel-id').value,
      room_id: +document.getElementById('book-room-id').value,
      check_in: document.getElementById('book-checkin').value,
      check_out: document.getElementById('book-checkout').value,
      guests: +document.getElementById('book-guests').value,
    };

    try {
      const res = await api(`${CONFIG.BOOKING_URL}/bookings/`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('booking-modal')).hide();
        showAlert('main-alert', `
          <strong>Demande de réservation envoyée !</strong>
          ${body.check_in} → ${body.check_out} · Total estimé : ${formatMoney(data.total_price)}
          <br><small class="text-muted">Votre réservation est en attente de validation par l'administrateur. Vous recevrez un email une fois traitée.</small>
          <a href="/bookings.html" class="alert-link ms-2">Voir mes réservations →</a>
        `, 'info');
      } else {
        showAlert('booking-alert', data.error || data.detail || JSON.stringify(data));
      }
    } catch {
      showAlert('booking-alert', 'Réservation échouée. Service de réservation indisponible.');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-send me-1"></i>Envoyer la demande';
  });
});

async function loadHotels(page = 1) {
  currentPage = page;
  const container = document.getElementById('hotels-container');
  if (!container) return;
  container.innerHTML = `<div class="col-12 text-center py-5">
    <div class="spinner-border text-primary" role="status"></div>
    <p class="mt-2 text-muted">Chargement des hôtels...</p>
  </div>`;

  try {
    const params = new URLSearchParams({ page });
    const search = document.getElementById('search-input')?.value;
    const city = document.getElementById('filter-city')?.value;
    const stars = document.getElementById('filter-stars')?.value;
    if (search) params.set('search', search);
    if (city) params.set('city', city);
    if (stars) params.set('stars', stars);

    const res = await fetch(`${CONFIG.HOTEL_URL}/hotels/?${params}`);
    if (!res.ok) throw new Error('Impossible de charger les hôtels');
    const data = await res.json();

    renderHotels(data.results || data);
    renderPagination(data);
    loadCityFilter();
  } catch (err) {
    container.innerHTML = `<div class="col-12">
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Impossible de charger les hôtels. Service hôtel indisponible.
        <br><small>${err.message}</small>
      </div>
    </div>`;
  }
}

async function loadCityFilter() {
  const select = document.getElementById('filter-city');
  if (!select || select.options.length > 1) return;
  try {
    const res = await fetch(`${CONFIG.HOTEL_URL}/hotels/cities/`);
    if (res.ok) {
      (await res.json()).forEach(city => {
        select.insertAdjacentHTML('beforeend', `<option value="${city}">${city}</option>`);
      });
    }
  } catch (_) { }
}

function renderHotels(hotels) {
  const container = document.getElementById('hotels-container');
  if (!hotels.length) {
    container.innerHTML = `<div class="col-12 text-center py-5">
      <i class="bi bi-building fs-1 text-muted"></i>
      <p class="mt-3 text-muted">Aucun hôtel trouvé.</p>
    </div>`;
    return;
  }
  container.innerHTML = hotels.map(h => `
    <div class="col-sm-6 col-lg-4 mb-4">
      <div class="card h-100 shadow-sm hotel-card" onclick="viewHotel(${h.id})" style="cursor:pointer">
        <img src="${h.image_url || `https://placehold.co/400x220/4a5568/white?text=${encodeURIComponent(h.name)}`}"
             class="card-img-top" style="height:200px;object-fit:cover" alt="${h.name}">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <h5 class="card-title mb-0">${h.name}</h5>
            <span class="badge bg-warning text-dark ms-2">${'★'.repeat(h.stars)}</span>
          </div>
          <p class="text-muted small mb-2"><i class="bi bi-geo-alt-fill me-1 text-danger"></i>${h.city}, ${h.country}</p>
          <div class="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
            <span class="text-success fw-semibold">
              ${h.min_price ? 'À partir de ' + formatMoney(h.min_price) + '/nuit' : 'Prix variables'}
            </span>
            <span class="badge bg-secondary bg-opacity-10 text-dark border">${h.rooms_count} chambre(s)</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPagination(data) {
  const container = document.getElementById('pagination');
  if (!container || !data.count) return;
  const total = Math.ceil(data.count / 12);
  if (total <= 1) { container.innerHTML = ''; return; }
  const pages = Array.from({ length: total }, (_, i) => i + 1).map(i =>
    `<li class="page-item ${i === currentPage ? 'active' : ''}">
      <button class="page-link" onclick="loadHotels(${i})">${i}</button>
    </li>`
  ).join('');
  container.innerHTML = `<nav><ul class="pagination justify-content-center">${pages}</ul></nav>`;
}

async function viewHotel(id) {
  try {
    const [hotelRes, roomsRes] = await Promise.all([
      fetch(`${CONFIG.HOTEL_URL}/hotels/${id}/`),
      fetch(`${CONFIG.HOTEL_URL}/hotels/${id}/rooms/`),
    ]);
    if (!hotelRes.ok) throw new Error('Hôtel introuvable');
    const hotel = await hotelRes.json();
    const rooms = roomsRes.ok ? await roomsRes.json() : [];

    // L'admin ne peut pas réserver
    const userIsAdmin = isAdmin();

    document.getElementById('modal-hotel-name').textContent = hotel.name;
    document.getElementById('modal-hotel-body').innerHTML = `
      <img src="${hotel.image_url || `https://placehold.co/800x300/4a5568/white?text=${encodeURIComponent(hotel.name)}`}"
           class="img-fluid rounded mb-3 w-100" style="height:250px;object-fit:cover">
      <p><i class="bi bi-geo-alt-fill text-danger me-2"></i><strong>${hotel.address}, ${hotel.city}, ${hotel.country}</strong></p>
      <p>${hotel.description || ''}</p>
      ${hotel.amenities?.length ? `<p><strong>Équipements :</strong> ${hotel.amenities.join(', ')}</p>` : ''}
      <h6 class="fw-bold mb-3">Chambres disponibles</h6>
      ${!rooms.length ? '<p class="text-muted">Aucune chambre disponible.</p>' : rooms.map(room => `
        <div class="card mb-2 ${!room.is_available ? 'opacity-50' : ''}">
          <div class="card-body py-2 d-flex justify-content-between align-items-center">
            <div>
              <strong>Chambre ${room.number}</strong>
              <span class="badge bg-secondary ms-2">${room.room_type}</span>
              <span class="text-muted ms-2 small">👤 max ${room.capacity}</span>
            </div>
            <div class="text-end">
              <div class="fw-bold text-success">${formatMoney(room.price_per_night)}/nuit</div>
              ${room.is_available && isLoggedIn() && !userIsAdmin
        ? `<button class="btn btn-sm btn-primary mt-1 btn-book"
                     data-hotel-id="${hotel.id}" data-hotel-name="${hotel.name}"
                     data-room-id="${room.id}"   data-room-number="${room.number}"
                     data-room-type="${room.room_type}" data-price="${room.price_per_night}">
                     <i class="bi bi-send me-1"></i>Demander</button>`
        : room.is_available && !isLoggedIn()
          ? `<a href="/login.html" class="btn btn-sm btn-outline-primary mt-1">Connectez-vous</a>`
          : room.is_available && userIsAdmin
            ? `<span class="badge bg-info text-dark">Vue admin</span>`
            : `<span class="badge bg-danger">Indisponible</span>`
      }
            </div>
          </div>
        </div>`).join('')}
    `;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('hotel-modal')).show();
  } catch (err) {
    alert('Impossible de charger les détails : ' + err.message);
  }
}

function openBooking(hotelId, hotelName, roomId, roomNumber, roomType, price) {
  if (!requireAuth()) return;
  document.getElementById('book-hotel-id').value = hotelId;
  document.getElementById('book-room-id').value = roomId;
  document.getElementById('book-room-info').textContent = `${hotelName} — Chambre ${roomNumber} (${roomType}) — ${formatMoney(price)}/nuit`;
  document.getElementById('book-price').value = price;

  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  document.getElementById('book-checkin').min = today;
  document.getElementById('book-checkin').value = today;
  document.getElementById('book-checkout').min = today;
  document.getElementById('book-checkout').value = nextWeek;

  const hotelModalEl = document.getElementById('hotel-modal');
  const hotelModal = bootstrap.Modal.getInstance(hotelModalEl);
  const showBooking = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('booking-modal')).show();

  if (hotelModal) {
    hotelModalEl.addEventListener('hidden.bs.modal', showBooking, { once: true });
    hotelModal.hide();
  } else {
    showBooking();
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}