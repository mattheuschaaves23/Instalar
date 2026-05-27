const crypto = require('crypto');
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

function createAccessToken() {
  return crypto.randomBytes(24).toString('hex');
}

function joinRegion(item) {
  return [item.neighborhood, item.city, item.state].filter(Boolean).join(' - ');
}

function buildInstallerMessage(installer, request) {
  const installerName = installer.business_name || installer.name || 'um instalador da Instalar+';
  const service = request.service_label || 'instalacao de papel de parede';
  const region = joinRegion(request);

  return [
    `Ola ${request.client_name}, sou ${installerName}.`,
    `Voce me escolheu na Instalar+ para falar sobre ${service}${region ? ` em ${region}` : ''}.`,
    'Posso combinar os detalhes pelo WhatsApp?',
  ].join(' ');
}

function buildClientMessage(installer, request) {
  const installerName = installer.display_name || installer.business_name || installer.name || 'instalador';
  const service = request.service_label || 'instalacao de papel de parede';

  return `Ola ${installerName}, escolhi voce na Instalar+ para conversar sobre meu pedido de ${service}.`;
}

function serializeOpportunity(row) {
  const selectedByMe = Boolean(row.selected_by_me || row.my_interest_status === 'selected');
  const interestedByMe = Boolean(row.interested_by_me || row.my_interest_status);

  return {
    id: row.id,
    client_name: row.client_name,
    client_phone: selectedByMe ? row.client_phone : null,
    client_phone_masked: maskPhone(row.client_phone),
    client_email: selectedByMe ? row.client_email : null,
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
    zip_code: row.zip_code,
    neighborhood: row.neighborhood,
    address_reference: row.address_reference,
    city: row.city,
    state: row.state,
    details: row.details,
    photo_count: Number(row.photo_count || 0),
    photo_names: row.photo_names || [],
    status: row.status,
    interested_by_me: interestedByMe,
    selected_by_me: selectedByMe,
    my_interest_status: row.my_interest_status || null,
    my_interest_at: row.my_interest_at || null,
    selected_at: row.selected_at || null,
    match_score: Number(row.match_score || 0),
    distance_label: row.distance_label || 'Regiao a confirmar',
    whatsapp_url: selectedByMe ? row.whatsapp_url || null : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeClientRequest(row) {
  return {
    id: row.id,
    service: row.service,
    service_label: row.service_label,
    rooms: row.rooms || [],
    material_label: row.material_label,
    measurement_detail: row.measurement_detail,
    urgency_label: row.urgency_label,
    budget_label: row.budget_label,
    zip_code: row.zip_code,
    neighborhood: row.neighborhood,
    address_reference: row.address_reference,
    city: row.city,
    state: row.state,
    status: row.status,
    selected_installer_id: row.selected_installer_id || null,
    selected_at: row.selected_at || null,
    created_at: row.created_at,
  };
}

function serializeClientInterest(row, request) {
  const selected = row.status === 'selected';

  return {
    id: row.id,
    installer_id: row.installer_id,
    status: row.status,
    created_at: row.created_at,
    selected,
    display_name: row.display_name,
    city: row.city,
    state: row.state,
    logo: row.logo,
    installer_photo: row.installer_photo,
    average_rating: Number(row.average_rating || 0),
    review_count: Number(row.review_count || 0),
    featured_installer: Boolean(row.featured_installer),
    certification_verified: Boolean(row.certification_verified),
    whatsapp_url: selected && row.phone ? generateWhatsAppLink(row.phone, buildClientMessage(row, request)) : null,
  };
}

async function getInstaller(installerId) {
  const result = await pool.query(
    `
      SELECT id, name, business_name, phone, city, state, service_region
      FROM users
      WHERE id = $1
        AND COALESCE(account_type, 'installer') = 'installer'
      LIMIT 1
    `,
    [installerId]
  );

  return result.rows[0] || null;
}

async function getRequestForClient(requestId, token) {
  const result = await pool.query(
    `
      SELECT *
      FROM service_requests
      WHERE id = $1
        AND client_access_token = $2
      LIMIT 1
    `,
    [requestId, token]
  );

  return result.rows[0] || null;
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
    const accessToken = createAccessToken();

    if (!clientName || clientName.length < 2) {
      return res.status(400).json({ error: 'Informe seu nome para publicar a solicitacao.' });
    }

    if (clientPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ error: 'Informe um WhatsApp valido para o instalador escolhido chamar voce.' });
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
          zip_code,
          neighborhood,
          address_reference,
          city,
          state,
          details,
          photo_count,
          photo_names,
          client_access_token
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::TEXT[], $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27::JSONB, $28
        )
        RETURNING
          id,
          client_name,
          service,
          service_label,
          rooms,
          zip_code,
          neighborhood,
          address_reference,
          city,
          state,
          urgency_label,
          budget_label,
          measurement_detail,
          status,
          client_access_token,
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
        normalizeOptionalText(req.body.zip_code, 20),
        normalizeOptionalText(req.body.neighborhood, 120),
        normalizeOptionalText(req.body.address_reference, 300),
        city,
        state || null,
        normalizeOptionalText(req.body.details, 800),
        Math.max(0, Math.min(4, Number(req.body.photo_count || photoNames.length || 0))),
        JSON.stringify(photoNames),
        accessToken,
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
    const status = ['interested', 'selected', 'all'].includes(rawStatus) ? rawStatus : 'open';
    const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 100);
    const city = normalizeOptionalText(req.query.city, 120);
    const state = normalizeState(req.query.state);
    const values = [req.userId, installer.city || '', installer.state || '', city || '', state || '', limit];
    const filters = [];

    if (status === 'selected') {
      filters.push("sri.status = 'selected'");
    } else {
      filters.push("sr.status = 'open'");

      if (status === 'interested') {
        filters.push("sri.status = 'interested'");
      } else if (status === 'open') {
        filters.push('sri.id IS NULL');
      }
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
          sri.id IS NOT NULL AS interested_by_me,
          sri.status AS my_interest_status,
          sri.created_at AS my_interest_at,
          sr.selected_installer_id = $1 AS selected_by_me,
          CASE
            WHEN LOWER(COALESCE(sr.city, '')) = LOWER(NULLIF($2, ''))
              AND LOWER(COALESCE(sr.state, '')) = LOWER(NULLIF($3, '')) THEN 100
            WHEN LOWER(COALESCE(sr.state, '')) = LOWER(NULLIF($3, '')) THEN 82
            WHEN NULLIF(sr.state, '') IS NULL OR NULLIF($3, '') IS NULL THEN 64
            ELSE 38
          END AS match_score,
          CASE
            WHEN LOWER(COALESCE(sr.city, '')) = LOWER(NULLIF($2, ''))
              AND LOWER(COALESCE(sr.state, '')) = LOWER(NULLIF($3, '')) THEN 'Mesma cidade'
            WHEN LOWER(COALESCE(sr.state, '')) = LOWER(NULLIF($3, '')) THEN 'Mesmo estado'
            ELSE 'Outra regiao'
          END AS distance_label
        FROM service_requests sr
        LEFT JOIN service_request_interests sri
          ON sri.request_id = sr.id
          AND sri.installer_id = $1
        WHERE ${filters.join(' AND ')}
        ORDER BY
          selected_by_me DESC,
          interested_by_me DESC,
          match_score DESC,
          sr.created_at DESC
        LIMIT $6
      `,
      values
    );

    const opportunities = result.rows.map((row) => {
      if (!row.selected_by_me) {
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
        open: opportunities.filter((item) => !item.interested_by_me && item.status === 'open').length,
        interested: opportunities.filter((item) => item.my_interest_status === 'interested').length,
        selected: opportunities.filter((item) => item.selected_by_me).length,
        matched: opportunities.filter((item) => item.match_score >= 82).length,
      },
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Nao foi possivel carregar oportunidades.' });
  }
};

exports.expressInterest = async (req, res) => {
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
      return res.status(404).json({ error: 'Oportunidade nao encontrada ou ja encerrada.' });
    }

    await pool.query(
      `
        INSERT INTO service_request_interests (request_id, installer_id, status)
        VALUES ($1, $2, 'interested')
        ON CONFLICT (request_id, installer_id)
        DO UPDATE SET
          status = CASE
            WHEN service_request_interests.status = 'selected' THEN 'selected'
            ELSE 'interested'
          END,
          updated_at = NOW()
      `,
      [requestId, req.userId]
    );

    return res.json({
      opportunity: serializeOpportunity({
        ...request,
        interested_by_me: true,
        my_interest_status: 'interested',
        my_interest_at: new Date().toISOString(),
        match_score: 100,
        distance_label: 'Interesse enviado',
      }),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Nao foi possivel enviar interesse.' });
  }
};

exports.getPublicServiceRequestInterests = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const token = normalizeText(req.query.token || req.headers['x-client-request-token'], 80);

    if (!Number.isInteger(requestId) || requestId <= 0 || !token) {
      return res.status(400).json({ error: 'Solicitacao invalida.' });
    }

    const request = await getRequestForClient(requestId, token);

    if (!request) {
      return res.status(404).json({ error: 'Solicitacao nao encontrada.' });
    }

    const result = await pool.query(
      `
        SELECT
          sri.id,
          sri.status,
          sri.created_at,
          u.id AS installer_id,
          COALESCE(NULLIF(u.business_name, ''), u.name) AS display_name,
          u.logo,
          u.installer_photo,
          u.city,
          u.state,
          u.phone,
          u.featured_installer,
          u.certification_verified,
          COALESCE(reviews.average_rating, 0) AS average_rating,
          COALESCE(reviews.review_count, 0)::int AS review_count
        FROM service_request_interests sri
        JOIN users u ON u.id = sri.installer_id
        LEFT JOIN (
          SELECT installer_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
          FROM installer_reviews
          GROUP BY installer_id
        ) reviews ON reviews.installer_id = u.id
        WHERE sri.request_id = $1
          AND sri.status IN ('interested', 'selected')
        ORDER BY
          (sri.status = 'selected') DESC,
          COALESCE(reviews.average_rating, 0) DESC,
          sri.created_at ASC
      `,
      [requestId]
    );

    return res.json({
      request: serializeClientRequest(request),
      interests: result.rows.map((row) => serializeClientInterest(row, request)),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Nao foi possivel carregar interessados.' });
  }
};

exports.selectServiceRequestInterest = async (req, res) => {
  const client = await pool.connect();

  try {
    const requestId = Number(req.params.id);
    const interestId = Number(req.params.interestId);
    const token = normalizeText(req.body.token || req.query.token || req.headers['x-client-request-token'], 80);

    if (!Number.isInteger(requestId) || requestId <= 0 || !Number.isInteger(interestId) || interestId <= 0 || !token) {
      return res.status(400).json({ error: 'Escolha invalida.' });
    }

    await client.query('BEGIN');

    const requestResult = await client.query(
      `
        SELECT *
        FROM service_requests
        WHERE id = $1
          AND client_access_token = $2
        FOR UPDATE
      `,
      [requestId, token]
    );
    const request = requestResult.rows[0];

    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitacao nao encontrada.' });
    }

    const interestResult = await client.query(
      `
        SELECT sri.*, u.phone, u.name, u.business_name, COALESCE(NULLIF(u.business_name, ''), u.name) AS display_name
        FROM service_request_interests sri
        JOIN users u ON u.id = sri.installer_id
        WHERE sri.id = $1
          AND sri.request_id = $2
          AND sri.status IN ('interested', 'selected')
        LIMIT 1
      `,
      [interestId, requestId]
    );
    const interest = interestResult.rows[0];

    if (!interest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Instalador interessado nao encontrado.' });
    }

    await client.query(
      `
        UPDATE service_request_interests
        SET status = CASE WHEN id = $1 THEN 'selected' ELSE 'interested' END,
            updated_at = NOW()
        WHERE request_id = $2
      `,
      [interestId, requestId]
    );

    const updatedRequestResult = await client.query(
      `
        UPDATE service_requests
        SET selected_installer_id = $1,
            selected_at = NOW(),
            status = 'selected',
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [interest.installer_id, requestId]
    );

    await client.query('COMMIT');

    const updatedRequest = updatedRequestResult.rows[0];

    return res.json({
      request: serializeClientRequest(updatedRequest),
      selected_interest: serializeClientInterest({ ...interest, status: 'selected' }, updatedRequest),
    });
  } catch (_error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Nao foi possivel escolher o instalador.' });
  } finally {
    client.release();
  }
};
