(() => {
  const $ = (id) => document.getElementById(id);
  const ui = {
    overall: $('overall-status'),
    city: $('city-input'),
    library: $('library-select'),
    books: $('books-list'),
    catalogCount: $('catalog-count'),
    user: $('username-input'),
    stars: $('stars-value'),
    active: $('active-count'),
    available: $('available-count'),
    loans: $('loans-list'),
    traceSummary: $('trace-summary'),
    traceMethod: $('trace-method'),
    traceFlow: $('trace-flow'),
    toast: $('toast'),
  };
  const ids = {
    library: '83575e12-7ce0-48ee-9931-51919ff3c9ee',
    book: 'f7cdc58f-2caf-4b15-9727-f89dcc629b27',
  };
  let libraries = [];
  let toastTimer;

  function localDateString(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: { ...(options.headers || {}) },
    });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        if (body.message) message = body.message;
      } catch (_) { /* An empty error body is valid. */ }
      throw new Error(message);
    }
    if (response.status === 204) return null;
    const type = response.headers.get('content-type') || '';
    return type.includes('application/json') ? response.json() : null;
  }

  function userHeaders() {
    const username = ui.user.value.trim();
    if (!username) throw new Error('Escribe un nombre de usuario.');
    return { 'X-User-Name': username };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function setTrace(summary, method, steps) {
    ui.traceSummary.textContent = summary;
    ui.traceMethod.textContent = method;
    ui.traceFlow.innerHTML = steps.map((step, index) =>
      `${index ? '<span class="trace-arrow">→</span>' : ''}<span class="trace-step current">${escapeHtml(step)}</span>`
    ).join('');
  }

  function notify(message, isError = false) {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.toggle('error', isError);
    ui.toast.classList.add('visible');
    toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 3600);
  }

  async function refreshHealth() {
    const services = await api('/api/v1/system/health');
    let up = 0;
    for (const [name, status] of Object.entries(services)) {
      const card = document.querySelector(`[data-service="${name}"]`);
      const state = card?.querySelector('.service-state');
      if (name === 'gateway') continue;
      if (state) {
        state.classList.toggle('down', status !== 'UP');
        state.querySelector('b').textContent = status;
      }
      if (status === 'UP') up += 1;
    }
    const allUp = up === 3;
    ui.overall.textContent = allUp ? 'Todos los servicios activos' : `${up}/3 servicios activos`;
    document.querySelector('.pulse').classList.toggle('down', !allUp);
    setTrace(allUp ? 'Gateway está alcanzando los servicios internos.' : 'Un servicio no responde; comprueba Docker Compose.', 'GET /api/v1/system/health', ['Navegador', 'Gateway', 'Library · Reservation · Rating']);
    return allUp;
  }

  async function loadLibraries() {
    const city = ui.city.value.trim();
    if (!city) throw new Error('Escribe una ciudad para buscar bibliotecas.');
    const page = await api(`/api/v1/libraries?city=${encodeURIComponent(city)}&page=1&size=50`);
    libraries = page?.items || [];
    const previous = ui.library.value;
    ui.library.innerHTML = libraries.length
      ? libraries.map((library) => `<option value="${escapeHtml(library.libraryUid)}">${escapeHtml(library.name)} · ${escapeHtml(library.address)}</option>`).join('')
      : '<option value="">No hay bibliotecas en esta ciudad</option>';
    if (libraries.some((item) => item.libraryUid === previous)) ui.library.value = previous;
    else if (libraries.some((item) => item.libraryUid === ids.library)) ui.library.value = ids.library;
    ui.catalogCount.textContent = `${page?.totalElements ?? libraries.length} bibliotecas`;
    setTrace(`GET encontró ${libraries.length} biblioteca(s) en ${city}.`, 'GET /api/v1/libraries', ['Navegador', 'Gateway', 'Library', 'libraries']);
    await loadBooks();
  }

  async function loadBooks() {
    const libraryUid = ui.library.value;
    if (!libraryUid) {
      ui.books.innerHTML = '<p class="empty-state">No hay bibliotecas para mostrar.</p>';
      ui.available.textContent = '0';
      return;
    }
    ui.books.innerHTML = '<div class="loading-line"><span class="spinner"></span> Consultando Library…</div>';
    const page = await api(`/api/v1/libraries/${encodeURIComponent(libraryUid)}/books?page=1&size=50&showAll=true`);
    const books = page?.items || [];
    const available = books.reduce((sum, book) => sum + Math.max(0, book.availableCount || 0), 0);
    ui.available.textContent = String(available);
    ui.catalogCount.textContent = `${available} ejemplar${available === 1 ? '' : 'es'} disponible${available === 1 ? '' : 's'}`;
    if (!books.length) {
      ui.books.innerHTML = '<p class="empty-state">Esta biblioteca todavía no tiene libros cargados.</p>';
      return;
    }
    ui.books.innerHTML = books.map((book) => {
      const stock = Number(book.availableCount || 0);
      return `<article class="book-row">
        <div class="book-art" aria-hidden="true">BK</div>
        <div><div class="book-name">${escapeHtml(book.name)}</div><div class="book-meta">${escapeHtml(book.author || 'Autor no indicado')} · ${escapeHtml(book.genre || 'Sin género')}</div><div class="book-condition">ESTADO ORIGINAL · ${escapeHtml(book.condition || '—')}</div></div>
        <div class="book-action"><span class="availability ${stock < 1 ? 'none' : ''}">${stock > 0 ? `${stock} disponible${stock === 1 ? '' : 's'}` : 'Agotado'}</span><button class="take-button" data-take="${escapeHtml(book.bookUid)}" ${stock < 1 ? 'disabled' : ''} type="button">Pedir libro</button></div>
      </article>`;
    }).join('');
  }

  async function loadAccount() {
    const headers = userHeaders();
    const [rating, loans] = await Promise.all([
      api('/api/v1/rating', { headers }),
      api('/api/v1/reservations', { headers }),
    ]);
    const rows = loans || [];
    ui.stars.textContent = rating?.stars ?? '—';
    const active = rows.filter((row) => row.status === 'RENTED').length;
    ui.active.textContent = `${active} / ${rating?.stars ?? 0}`;
    if (!rows.length) {
      ui.loans.innerHTML = '<p class="empty-state">No hay préstamos para este usuario. Pide un libro para ver aquí el flujo completo.</p>';
      return;
    }
    ui.loans.innerHTML = rows.map((loan) => {
      const library = libraries.find((item) => item.libraryUid === loan.libraryUid);
      const statusClass = loan.status === 'RENTED' ? 'rented' : loan.status === 'EXPIRED' ? 'expired' : '';
      const statusLabel = loan.status === 'RENTED' ? 'PRESTADO' : loan.status === 'RETURNED' ? 'DEVUELTO' : 'VENCIDO';
      return `<article class="loan-row">
        <div><div class="loan-name">${escapeHtml(loan.book?.name || loan.bookUid)}</div><div class="loan-meta">${escapeHtml(library?.name || loan.library?.name || 'Biblioteca')} · hasta ${escapeHtml(loan.tillDate)}</div></div>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
        ${loan.status === 'RENTED' ? `<div class="return-controls"><input aria-label="Fecha de devolución" type="date" data-return-date="${escapeHtml(loan.reservationUid)}" value="${localDateString()}"><select aria-label="Condición de devolución" data-return-condition="${escapeHtml(loan.reservationUid)}"><option>EXCELLENT</option><option>GOOD</option><option>BAD</option></select><button class="return-button" data-return="${escapeHtml(loan.reservationUid)}" type="button">Devolver</button></div>` : '<span class="no-return">CERRADO</span>'}
      </article>`;
    }).join('');
  }

  async function refreshDashboard() {
    try {
      await refreshHealth();
      await loadLibraries();
      await loadAccount();
    } catch (error) {
      notify(error.message || 'No se pudo actualizar la vista.', true);
      if (!libraries.length) ui.books.innerHTML = `<p class="error-state">${escapeHtml(error.message)} · revisa que Docker Compose siga activo.</p>`;
    }
  }

  async function takeBook(bookUid) {
    const headers = userHeaders();
    const libraryUid = ui.library.value;
    const tillDate = localDateString(new Date(Date.now() + 7 * 86400000));
    const button = document.querySelector(`[data-take="${CSS.escape(bookUid)}"]`);
    if (button) { button.disabled = true; button.textContent = 'Procesando…'; }
    setTrace('Gateway consulta estrellas y préstamos activos; después reserva inventario y crea la reserva.', 'POST /api/v1/reservations', ['Navegador', 'Gateway', 'Rating', 'Reservation', 'Library']);
    try {
      const reservation = await api('/api/v1/reservations', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookUid, libraryUid, tillDate }),
      });
      setTrace(`Préstamo ${String(reservation.reservationUid).slice(0, 8)} creado con estado ${reservation.status}.`, 'POST /api/v1/reservations · 200', ['Navegador', 'Gateway', 'Rating', 'Library', 'Reservation']);
      notify('Préstamo creado. La reserva ya aparece en tu cuenta.');
      await Promise.all([loadBooks(), loadAccount()]);
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = 'Pedir libro'; }
      setTrace(`El Gateway rechazó la solicitud: ${error.message}`, 'POST /api/v1/reservations · error', ['Navegador', 'Gateway', 'Validación']);
      notify(error.message, true);
    }
  }

  async function returnBook(reservationUid) {
    const headers = userHeaders();
    const date = document.querySelector(`[data-return-date="${CSS.escape(reservationUid)}"]`)?.value;
    const condition = document.querySelector(`[data-return-condition="${CSS.escape(reservationUid)}"]`)?.value;
    if (!date) { notify('Elige la fecha de devolución.', true); return; }
    setTrace('Gateway verifica la reserva activa, devuelve la copia, cambia el estado y ajusta el rating.', 'POST /api/v1/reservations/{id}/return', ['Navegador', 'Gateway', 'Reservation', 'Library', 'Rating']);
    try {
      await api(`/api/v1/reservations/${encodeURIComponent(reservationUid)}/return`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition, date }),
      });
      setTrace('Devolución completada. Inventario, reserva y rating se actualizaron.', 'POST /api/v1/reservations/{id}/return · 204', ['Navegador', 'Gateway', 'Reservation', 'Library', 'Rating']);
      notify('Libro devuelto correctamente.');
      await Promise.all([loadBooks(), loadAccount()]);
    } catch (error) {
      setTrace(`No se completó la devolución: ${error.message}`, 'POST /api/v1/reservations/{id}/return · error', ['Navegador', 'Gateway', 'Validación']);
      notify(error.message, true);
    }
  }

  $('refresh-button').addEventListener('click', refreshDashboard);
  $('load-user').addEventListener('click', () => loadAccount().catch((error) => notify(error.message, true)));
  ui.user.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadAccount().catch((error) => notify(error.message, true)); });
  ui.city.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadLibraries().catch((error) => notify(error.message, true)); });
  ui.library.addEventListener('change', () => loadBooks().catch((error) => notify(error.message, true)));
  ui.books.addEventListener('click', (event) => {
    const button = event.target.closest('[data-take]');
    if (button) takeBook(button.dataset.take).catch((error) => notify(error.message, true));
  });
  ui.loans.addEventListener('click', (event) => {
    const button = event.target.closest('[data-return]');
    if (button) returnBook(button.dataset.return).catch((error) => notify(error.message, true));
  });

  refreshDashboard();
})();
