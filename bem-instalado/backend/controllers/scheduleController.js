const pool = require('../config/database');
const { parseLocalDateTime } = require('../utils/appTimeZone');

function normalizeString(value) {
  return String(value || '').trim();
}

function firstFilled(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function buildDestination(schedule) {
  const street = firstFilled(schedule.service_street, schedule.client_street);
  const number = firstFilled(schedule.service_number, schedule.client_house_number);
  const neighborhood = firstFilled(schedule.service_neighborhood, schedule.client_neighborhood);
  const city = firstFilled(schedule.service_city, schedule.client_city);
  const state = firstFilled(schedule.service_state, schedule.client_state);
  const zipCode = firstFilled(schedule.service_zip_code, schedule.client_zip_code);
  const reference = firstFilled(schedule.service_reference, schedule.client_address_reference);

  const line1 = [street, number && `Nº ${number}`].filter(Boolean).join(', ');
  const line2 = [neighborhood, [city, state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  const formatted = [line1, line2, zipCode && `CEP ${zipCode}`].filter(Boolean).join(' • ');

  const fullAddress = firstFilled(schedule.service_full_address, formatted, schedule.client_address);
  const routeQuery = firstFilled(fullAddress, line1, line2);

  return {
    street: street || null,
    house_number: number || null,
    neighborhood: neighborhood || null,
    city: city || null,
    state: state || null,
    zip_code: zipCode || null,
    reference: reference || null,
    full_address: fullAddress || null,
    route_query: routeQuery || null,
  };
}

function buildRouteLinks(routeQuery) {
  if (!routeQuery) {
    return { google_maps: null, waze: null };
  }

  const encoded = encodeURIComponent(routeQuery);
  return {
    google_maps: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    waze: `https://waze.com/ul?q=${encoded}&navigate=yes`,
  };
}

exports.getSchedules = async (req, res) => {
  try {
    const params = [req.userId];
    let query = `
      SELECT
        s.*,
        c.name AS client_name,
        c.address AS client_address,
        c.street AS client_street,
        c.house_number AS client_house_number,
        c.neighborhood AS client_neighborhood,
        c.city AS client_city,
        c.state AS client_state,
        c.zip_code AS client_zip_code,
        c.address_reference AS client_address_reference
      FROM schedules s
      JOIN clients c ON c.id = s.client_id
      WHERE s.user_id = $1
    `;

    // start/end sem fuso sao horario de Sao Paulo (a coluna e TIMESTAMPTZ).
    const rangeStart = parseLocalDateTime(req.query.start);
    const rangeEnd = parseLocalDateTime(req.query.end);
    if (rangeStart && rangeEnd) {
      query += ' AND s.date BETWEEN $2 AND $3';
      params.push(rangeStart, rangeEnd);
    }

    query += ' ORDER BY s.date ASC';

    const { rows } = await pool.query(query, params);
    const bookingParams = [req.userId];
    let bookingQuery = `
      SELECT
        sb.id,
        sb.scheduled_start AS date,
        sb.scheduled_end,
        sb.status,
        sr.client_name,
        sr.service_label,
        sr.service,
        sr.address_reference AS service_reference,
        sr.neighborhood AS service_neighborhood,
        sr.city AS service_city,
        sr.state AS service_state,
        sr.zip_code AS service_zip_code
      FROM service_bookings sb
      JOIN service_requests sr ON sr.id = sb.service_request_id
      WHERE sb.installer_id = $1
    `;

    if (rangeStart && rangeEnd) {
      bookingQuery += ' AND sb.scheduled_start BETWEEN $2 AND $3';
      bookingParams.push(rangeStart, rangeEnd);
    }

    bookingQuery += ' ORDER BY sb.scheduled_start ASC';
    const bookingResult = await pool.query(bookingQuery, bookingParams);

    const legacySchedules = rows.map((row) => {
      const destination = buildDestination(row);
      const route_links = buildRouteLinks(destination.route_query);

      return {
        ...row,
        source: 'manual',
        destination,
        route_links,
      };
    });

    const marketplaceBookings = bookingResult.rows.map((row) => {
      const destination = buildDestination(row);
      const route_links = buildRouteLinks(destination.route_query);

      return {
        ...row,
        id: `marketplace-${row.id}`,
        marketplace_booking_id: row.id,
        source: 'marketplace',
        title: row.service_label || row.service || 'Serviço contratado pela plataforma',
        destination,
        route_links,
      };
    });

    const schedules = [...legacySchedules, ...marketplaceBookings].sort(
      (first, second) => new Date(first.date).getTime() - new Date(second.date).getTime()
    );

    return res.json(schedules);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar agenda.' });
  }
};

exports.reschedule = async (req, res) => {
  const id = Number(req.params.id);
  const value = req.body?.schedule_date;
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)
    ? parseLocalDateTime(value) : null;
  if (!Number.isInteger(id) || id < 1 || id > 2147483647 || !date) {
    return res.status(400).json({ error: 'Informe uma data e um horário válidos.' });
  }
  let db;
  let active = false;
  try {
    db = await pool.connect();
    await db.query('BEGIN');
    active = true;
    await db.query('SELECT pg_advisory_xact_lock($1)', [req.userId]);
    const ownership = await db.query(
      'SELECT id, budget_id, status FROM schedules WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [id, req.userId]
    );
    const item = ownership.rows[0];
    if (!item) return res.status(404).json({ error: 'Agendamento não encontrado.' });
    if (item.status !== 'scheduled') {
      return res.status(409).json({ error: 'Somente uma instalação agendada pode mudar de data.' });
    }
    const conflict = await db.query(`
      SELECT id FROM schedules WHERE user_id = $1 AND id <> $2 AND status = 'scheduled' AND date = $3
      UNION ALL
      SELECT id FROM service_bookings
      WHERE installer_id = $1 AND status IN ('scheduled', 'in_progress')
        AND scheduled_start <= $3 AND scheduled_end > $3
      LIMIT 1
    `, [req.userId, id, date]);
    if (conflict.rowCount) {
      return res.status(409).json({ code: 'SCHEDULE_TIME_CONFLICT', error: 'Esse horário já está ocupado na agenda.' });
    }
    const { rows } = await db.query(
      'UPDATE schedules SET date = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, date',
      [id, req.userId, date]
    );
    if (item.budget_id) {
      await db.query('UPDATE budgets SET schedule_date = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        [item.budget_id, req.userId, date]);
    }
    await db.query('COMMIT');
    active = false;
    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Não foi possível alterar a data do agendamento.' });
  } finally {
    if (active) await db.query('ROLLBACK').catch(() => {});
    db?.release();
  }
};

exports.updateScheduleStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['scheduled', 'completed', 'canceled']);

    if (!allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Status inválido para agendamento.' });
    }

    const { rows } = await pool.query(
      `
        UPDATE schedules
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `,
      [normalizedStatus, req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar agenda.' });
  }
};

exports.deleteSchedule = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `
        DELETE FROM schedules
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir evento.' });
  }
};
