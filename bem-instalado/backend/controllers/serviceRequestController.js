const pool = require('../config/database');
const generateWhatsAppLink = require('../utils/whatsapp');

function normalizeText(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeOptionalText(value, maxLength = 160) {
  const normalized = normalizeText(value, maxLength);
  return normalized || null;
}

function normalizeState(value) {
  return normalizeText(value, 2).toUpperCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 30);
}

function normalizeRooms(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item, 80)).filter(Boolean).slice(0, 8);
  }

  return String(value || '')
    .split(',')
    .map((item) => normalizeText(item, 80))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizePhotoNames(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeText(item, 120)).filter(Boolean).slice(0, 4);
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (digits.length <= 4) {
    return digits ? `****${digits}` : '';
  }

  return `${digits.slice(0, 2)} *****-${digits.slice(-4)}`;
}

function serializeOpportunity(row) {
  const acceptedByMe = Boolean(row.accepted_by_me);

  return {
    id: row.id,
    client_name: row.client_name,
    client_phone: acceptedByMe ? row.client_phone : null,
    client_phone_masked: maskPhone(row.client_phone),
    client_email: acceptedByMe ? row.client_email : null,
    service: row.service,
    service_label: row.service_label,
    rooms: row.rooms || [],
    material_status: row.material_status,
    material_label: row.material_label,
    measurement_status: row.measurement_status,
    measurement_label: row.measurement_label,
    measurement_detail: row.measurement_detail,
    wall_size: row.wall_size,
    roll_count: row.roll_count,
    urgency: row.urgency,
    urgency_label: row.urgency_label,
    budget: row.budget,
    budget_label: row.budget_label,
    contact_preference: row.contact_preference,
    contact_preference_label: row.contact_preference_label,
    city: row.city,
    state: row.state,
    details: row.details,
    photo_count: Number(row.photo_count || 0),
    photo_names: row.photo_names || [],
    status: row.status,
    accepted_by_me: acceptedByMe,
    my_interest_status: row.my_interest_status || null,
    my_interest_at: row.my_interest_at || null,
    match_score: Number(row.match_score || 0),
    whatsapp_url: acceptedByMe ? row.whatsapp_url || null : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getInstaller(installerId) {
  const result = await pool.query(
    `
      SELECT id, name, business_name, phone, city, state
      FROM users
      WHERE id = $1
        AND COALESCE(account_type, 'installer') = 'installer'
      LIMIT 1
    `,
    [installerId]
  );

  return result.rows[0] || null;
}

function buildInstallerMessage(installer, request) {
  const installerName = installer.business_name || installer.name || 'um instalador da Instalar+';
  const service = request.service_label || 'instalacao de papel de parede';
  const region = [request.city, request.state].filter(Boolean).join(' - ');

  return [
    `Ola ${request.client_name}, sou ${installerName}.`,
    `Vi sua solicitacao na Instalar+ sobre ${service}${region ? ` em ${region}` : ''}.`,
    'Posso conversar com voce e entender melhor o servico?',
  ].join(' ');
}

exports.createPublicServiceRequest = async (req, res) => {
  try {
    const clientName = normalizeText(req.body.client_name, 120);
    const clientPhone = normalizePhone(req.body.client_phone);
    const clientEmail = normalizeOptionalText(req.body.client_email, 150);
    const service = normalizeText(req.body.service, 60);
    const serviceLabel = normalizeOptionalText(req.body.service_label, 120);
    const city = normalizeOptionalText(req.body.city, 120);
    const state = normalizeState(req.body.state);
    const rooms = normalizeRooms(req.body.rooms || req.body.room);
    const photoNames = normalizePhotoNames(req.body.photo_names);

    if (!clientName || clientName.length < 2) {
      return res.status(400).json({ error: 'Informe seu nome para publicar a solicitacao.' });
    }

    if (clientPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ error: 'Informe um WhatsApp valido para os instaladores chamarem voce.' });
    }

    if (!service) {
      return res.status(400).json({ error: 'Escolha o tipo de servico antes de publicar.' });
    }

    if (!city && !state) {
      return res.status(400).json({ error: 'Informe cidade ou estado para direcionar a oportunidade.' });
    }

    const result = await pool.query(
      `
        INSERT INTO service_requests (
          client_name,
          client_phone,
          client_email,
          service,
          service_label,
          rooms,
          material_status,
          material_label,
          measurement_status,
          measurement_label,
          measurement_detail,
          wall_size,
          roll_count,
          urgency,
          urgency_label,
          budget,
          budget_label,
          contact_preference,
          contact_preference_label,
          city,
          state,
          details,
          photo_count,
          photo_names
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::TEXT[], $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24::JSONB
        )
        RETURNING
          id,
          client_name,
          service,
          service_label,
          rooms,
          city,
          state,
          urgency_label,
          budget_label,
          measurement_detail,
          status,
          created_at
      `,
      [
        clientName,
        clientPhone,
        clientEmail,
        service,
        serviceLabel,
        rooms,
        normalizeOptionalText(req.body.material_status, 40),
        normalizeOptionalText(req.body.material_label, 90),
        normalizeOptionalText(req.body.measurement_status, 40),
        normalizeOptionalText(req.body.measurement_label, 90),
        normalizeOptionalText(req.body.measurement_detail, 240),
        normalizeOptionalText(req.body.wall_size, 60),
        normalizeOptionalText(req.body.roll_count, 40),
        normalizeOptionalText(req.body.urgency, 40),
        normalizeOptionalText(req.body.urgency_label, 80),
        normalizeOptionalText(req.body.budget, 40),
        normalizeOptionalText(req.body.budget_label, 90),
        normalizeOptionalText(req.body.contact_preference, 40),
        normalizeOptionalText(req.body.contact_preference_label, 80),
        city,
        state || null,
        normalizeOptionalText(req.body.details, 800),
        Math.max(0, Math.min(4, Number(req.body.photo_count || photoNames.length || 0))),
        JSON.stringify(photoNames),
      ]
    );

    return res.status(201).json({ service_request: result.rows[0] });
  } catch (_error) {
    return res.status(500).json({ error: 'Nao foi possivel publicar a solicitacao agora.' });
  }
};

exports.getOpportunities = async (req, res) => {
  try {
    const installer = await getInstaller(req.userId);

    if (!installer) {
      return res.status(403).json({ error: 'Acesso restrito a instaladores.' });
    }

    const rawStatus = normalizeText(req.query.status, 20);
    const status = rawStatus === 'accepted' ? 'accepted' : rawStatus === 'all' ? 'all' : 'open';
    const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 100);
    const city = normalizeOptionalText(req.query.city, 120);
    const state = normalizeState(req.query.state);
    const values = [req.userId, installer.city || '', installer.state || '', city || '', state || '', limit];
    const filters = ["sr.status = 'open'"];

    if (status === 'accepted') {
      filters.push('sri.id IS NOT NULL');
    } else if (status === 'open') {
      filters.push('sri.id IS NULL');
    }

    if (city) {
      filters.push('sr.city ILIKE $4');
      values[3] = `%${city}%`;
    } else {
      values[3] = '';
    }

    if (state) {
      filters.push('sr.state ILIKE $5');
      values[4] = `%${state}%`;
    } else {
      values[4] = '';
    }

    const result = await pool.query(
      `
        SELECT
          sr.*,
          sri.id IS NOT NULL AS accepted_by_me,
          sri.status AS my_interest_status,
          sri.created_at AS my_interest_at,
          CASE
            WHEN LOWER(COALESCE(sr.city, '')) = LOWER(NULLIF($2, ''))
              AND LOWER(COALESCE(sr.state, '')) = LOWER(NULLIF($3, '')) THEN 100
            WHEN LOWER(COALESCE(sr.state, '')) = LOWER(NULLIF($3, '')) THEN 78
            WHEN NULLIF(sr.state, '') IS NULL OR NULLIF($3, '') IS NULL THEN 64
            ELSE 42
          END AS match_score
        FROM service_requests sr
        LEFT JOIN service_request_interests sri
          ON sri.request_id = sr.id
          AND sri.installer_id = $1
          AND sri.status = 'accepted'
        WHERE ${filters.join(' AND ')}
        ORDER BY
          accepted_by_me DESC,
          match_score DESC,
          sr.created_at DESC
        LIMIT $6
      `,
      values
    );

    const opportunities = result.rows.map((row) => {
      if (!row.accepted_by_me) {
        return serializeOpportunity(row);
      }

      return serializeOpportunity({
        ...row,
        whatsapp_url: generateWhatsAppLink(row.client_phone, buildInstallerMessage(installer, row)),
      });
    });

    return res.json({
      opportunities,
      stats: {
        open: opportunities.filter((item) => !item.accepted_by_me).length,
        accepted: opportunities.filter((item) => item.accepted_by_me).length,
        matched: opportunities.filter((item) => item.match_score >= 78).length,
      },
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Nao foi possivel carregar oportunidades.' });
  }
};

exports.acceptOpportunity = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const installer = await getInstaller(req.userId);

    if (!installer) {
      return res.status(403).json({ error: 'Acesso restrito a instaladores.' });
    }

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Oportunidade invalida.' });
    }

    const requestResult = await pool.query(
      `
        SELECT *
        FROM service_requests
        WHERE id = $1
          AND status = 'open'
        LIMIT 1
      `,
      [requestId]
    );
    const request = requestResult.rows[0];

    if (!request) {
      return res.status(404).json({ error: 'Oportunidade nao encontrada ou encerrada.' });
    }

    await pool.query(
      `
        INSERT INTO service_request_interests (request_id, installer_id, status)
        VALUES ($1, $2, 'accepted')
        ON CONFLICT (request_id, installer_id)
        DO UPDATE SET status = 'accepted', updated_at = NOW()
      `,
      [requestId, req.userId]
    );

    const message = buildInstallerMessage(installer, request);

    return res.json({
      opportunity: serializeOpportunity({
        ...request,
        accepted_by_me: true,
        my_interest_status: 'accepted',
        my_interest_at: new Date().toISOString(),
        match_score: 100,
        whatsapp_url: generateWhatsAppLink(request.client_phone, message),
      }),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Nao foi possivel aceitar a oportunidade.' });
  }
};
