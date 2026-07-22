const crypto = require('crypto');
const pool = require('../config/database');
const generateWhatsAppLink = require('../utils/whatsapp');
const { sendServiceRequestInterestEmail } = require('../services/email');
const { publicAssetUrl, storeProfileAsset } = require('../services/objectStorage');
const { normalizeSearchText } = require('../utils/textSearch');
const forwardGeocode = require('../utils/forwardGeocode');
const { validateUploadFile } = require('../utils/uploadValidation');

const CURRENT_TERMS_VERSION = '2026-07-22';

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

function normalizeOptionalEmail(value) {
  const email = normalizeOptionalText(value, 150)?.toLowerCase() || null;
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizeCoordinate(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const rawValues = [lat1, lon1, lat2, lon2];
  if (rawValues.some((value) => value === null || value === undefined || value === '')) return null;
  const values = rawValues.map(Number);
  if (!values.every(Number.isFinite)) return null;
  const toRadians = (value) => (value * Math.PI) / 180;
  const [firstLat, firstLon, secondLat, secondLon] = values.map(toRadians);
  const latitudeDelta = secondLat - firstLat;
  const longitudeDelta = secondLon - firstLon;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function normalizePhotoUrls(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter((item) => /^https:\/\//i.test(item) || item.startsWith('/api/public/assets/'))
    .slice(0, 4);
}

function getPublicAppUrl(req) {
  const configured = String(process.env.FRONTEND_URL || process.env.APP_URL || '').trim();
  const deploymentHost = String(
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ''
  ).trim();
  const trustedValue = configured || (deploymentHost
    ? deploymentHost.includes('://') ? deploymentHost : `https://${deploymentHost}`
    : '');

  if (trustedValue) {
    try {
      const trustedUrl = new URL(trustedValue);
      if (['http:', 'https:'].includes(trustedUrl.protocol)) {
        return trustedUrl.toString().replace(/\/+$/, '');
      }
    } catch (_error) {
      // Em desenvolvimento, a URL da requisição ainda pode ser usada como alternativa.
    }
  }

  const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
  const requestUrl = host ? `${protocol}://${host}` : '';

  if (process.env.NODE_ENV === 'production') {
    return '';
  }

  try {
    const parsed = new URL(requestUrl);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : '';
  } catch (_error) {
    return '';
  }
}

function buildTrackingUrl(req, request) {
  const baseUrl = getPublicAppUrl(req);
  const params = new URLSearchParams({
    pedido: String(request.id),
    acesso: String(request.client_access_token || ''),
  });

  return `${baseUrl}/cliente/pedido#${params.toString()}`;
}

function joinRegion(item) {
  return [item.neighborhood, item.city, item.state].filter(Boolean).join(' - ');
}

function buildInstallerMessage(installer, request) {
  const installerName = installer.business_name || installer.name || 'um instalador da InstalaPro';
  const service = request.service_label || 'instalacao de papel de parede';
  const region = joinRegion(request);

  return [
    `Ola ${request.client_name}, sou ${installerName}.`,
    `Voce me escolheu na InstalaPro para falar sobre ${service}${region ? ` em ${region}` : ''}.`,
    'Posso combinar os detalhes pelo WhatsApp?',
  ].join(' ');
}

function buildClientMessage(installer, request) {
  const installerName = installer.display_name || installer.business_name || installer.name || 'instalador';
  const service = request.service_label || 'instalacao de papel de parede';

  return `Ola ${installerName}, escolhi voce na InstalaPro para conversar sobre meu pedido de ${service}.`;
}

function serializeOpportunity(row) {
  const selectedByMe = Boolean(row.selected_by_me || row.my_interest_status === 'selected');
  const interestedByMe = Boolean(row.interested_by_me || row.my_interest_status);

  return {
    id: row.id,
    client_name: selectedByMe ? row.client_name : null,
    client_phone: selectedByMe ? row.client_phone : null,
    client_phone_masked: selectedByMe ? maskPhone(row.client_phone) : null,
    client_email: selectedByMe ? row.client_email : null,
    place_type: row.place_type,
    place_label: row.place_label,
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
    zip_code: selectedByMe ? row.zip_code : null,
    neighborhood: row.neighborhood,
    address_reference: selectedByMe ? row.address_reference : null,
    city: row.city,
    state: row.state,
    details: selectedByMe ? row.details : null,
    photo_count: Number(row.photo_count || 0),
    photo_names: selectedByMe ? row.photo_names || [] : [],
    photo_urls: selectedByMe ? row.photo_urls || [] : [],
    status: row.status,
    interested_by_me: interestedByMe,
    selected_by_me: selectedByMe,
    my_interest_status: row.my_interest_status || null,
    my_interest_at: row.my_interest_at || null,
    selected_at: row.selected_at || null,
    match_score: Number(row.match_score || 0),
    distance_label: row.distance_label || 'Regiao a confirmar',
    distance_km:
      row.distance_km === null || row.distance_km === undefined || row.distance_km === ''
        ? null
        : Number.isFinite(Number(row.distance_km))
          ? Number(row.distance_km)
          : null,
    whatsapp_url: selectedByMe ? row.whatsapp_url || null : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeClientRequest(row) {
  return {
    id: row.id,
    place_type: row.place_type,
    place_label: row.place_label,
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
    photo_urls: row.photo_urls || [],
    status: row.status,
    client_access_token: row.client_access_token || null,
    interests_count: Number(row.interests_count || 0),
    last_interest_at: row.last_interest_at || null,
    selected_installer_id: row.selected_installer_id || null,
    selected_at: row.selected_at || null,
    expires_at: row.expires_at || null,
    completed_at: row.completed_at || null,
    canceled_at: row.canceled_at || null,
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
      SELECT
        id,
        name,
        business_name,
        phone,
        city,
        state,
        service_region,
        latitude,
        longitude,
        service_radius_km,
        public_profile,
        certification_verified,
        is_admin
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
        AND COALESCE(account_type, 'installer') = 'installer'
      LIMIT 1
    `,
    [installerId]
  );

  const installer = result.rows[0] || null;

  if (
    installer &&
    (installer.latitude === null || installer.longitude === null) &&
    installer.city &&
    installer.state
  ) {
    try {
      const locations = await forwardGeocode(`${installer.city}, ${installer.state}, Brasil`, 1);
      if (locations[0]) {
        installer.latitude = locations[0].latitude;
        installer.longitude = locations[0].longitude;
        await pool.query(
          'UPDATE users SET latitude = $1, longitude = $2, updated_at = NOW() WHERE id = $3',
          [installer.latitude, installer.longitude, installer.id]
        );
      }
    } catch (_error) {
      // A busca por cidade continua funcionando se o geocodificador estiver indisponivel.
    }
  }

  return installer;
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
    const clientEmail = normalizeOptionalEmail(req.body.client_email);
    const placeType = normalizeOptionalText(req.body.place_type, 60);
    const placeLabel = normalizeOptionalText(req.body.place_label, 120);
    const service = normalizeText(req.body.service, 60);
    const serviceLabel = normalizeOptionalText(req.body.service_label, 120);
    const city = normalizeOptionalText(req.body.city, 120);
    const state = normalizeState(req.body.state);
    let latitude = normalizeCoordinate(req.body.latitude, -90, 90);
    let longitude = normalizeCoordinate(req.body.longitude, -180, 180);
    const rooms = normalizeRooms(req.body.rooms || req.body.room);
    const photoNames = normalizePhotoNames(req.body.photo_names);
    const photoUrls = normalizePhotoUrls(req.body.photo_urls);
    const accessToken = createAccessToken();
    const privacyConsent = req.body.privacy_consent === true;
    const clientUserId = req.user?.account_type === 'client' ? req.user.id : null;

    if (!clientName || clientName.length < 2) {
      return res.status(400).json({ error: 'Informe seu nome para publicar a solicitacao.' });
    }

    if (clientPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ error: 'Informe um WhatsApp valido para o instalador escolhido chamar voce.' });
    }

    if (req.body.client_email && !clientEmail) {
      return res.status(400).json({ error: 'Informe um e-mail válido ou deixe o campo vazio.' });
    }

    if (!service) {
      return res.status(400).json({ error: 'Escolha o tipo de servico antes de publicar.' });
    }

    if (!city && !state) {
      return res.status(400).json({ error: 'Informe cidade ou estado para direcionar a oportunidade.' });
    }

    if (!privacyConsent) {
      return res.status(400).json({
        error: 'Confirme os Termos de Uso e a Politica de Privacidade para publicar o pedido.',
        code: 'PRIVACY_CONSENT_REQUIRED',
      });
    }

    if ((latitude === null || longitude === null) && city) {
      try {
        const locations = await forwardGeocode(`${city}, ${state || ''}, Brasil`, 1);
        if (locations[0]) {
          latitude = locations[0].latitude;
          longitude = locations[0].longitude;
        }
      } catch (_error) {
        // O pedido continua publicavel usando cidade e estado como alternativa.
      }
    }

    const result = await pool.query(
      `
        INSERT INTO service_requests (
          client_name,
          client_phone,
          client_email,
          place_type,
          place_label,
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
          photo_urls,
          client_access_token,
          client_user_id,
          privacy_consent_at,
          terms_version,
          latitude,
          longitude
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::TEXT[], $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29::JSONB, $30::JSONB,
          $31, $32, $33, $34, $35, $36
        )
        RETURNING
          id,
          client_name,
          place_type,
          place_label,
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
          privacy_consent_at,
          terms_version,
          latitude,
          longitude,
          expires_at,
          photo_urls,
          created_at
      `,
      [
        clientName,
        clientPhone,
        clientEmail,
        placeType,
        placeLabel,
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
        JSON.stringify(photoUrls),
        accessToken,
        clientUserId,
        new Date(),
        CURRENT_TERMS_VERSION,
        latitude,
        longitude,
      ]
    );

    return res.status(201).json({ service_request: result.rows[0] });
  } catch (error) {
    console.error('Failed to create public service request:', error);
    return res.status(500).json({ error: 'Nao foi possivel publicar a solicitacao agora.' });
  }
};

exports.getMyServiceRequests = async (req, res) => {
  try {
    if (req.user?.account_type !== 'client') {
      return res.status(403).json({ error: 'Acompanhamento disponivel para contas de cliente.' });
    }

    await pool.query(
      `UPDATE service_requests SET status = 'expired', updated_at = NOW()
       WHERE status = 'open' AND expires_at <= NOW()`
    );
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
    const result = await pool.query(
      `
        SELECT
          sr.*,
          COALESCE(interests.interests_count, 0)::int AS interests_count
        FROM service_requests sr
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS interests_count
          FROM service_request_interests sri
          WHERE sri.request_id = sr.id
            AND sri.status IN ('interested', 'selected')
        ) interests ON TRUE
        WHERE sr.client_user_id = $1
        ORDER BY sr.created_at DESC
        LIMIT $2
      `,
      [req.userId, limit]
    );

    return res.json({
      requests: result.rows.map((request) => ({
        ...serializeClientRequest(request),
        tracking_url: buildTrackingUrl(req, request),
      })),
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Nao foi possivel carregar seus pedidos.' });
  }
};

exports.claimServiceRequest = async (req, res) => {
  try {
    if (req.user?.account_type !== 'client') {
      return res.status(403).json({ error: 'Vinculação disponível somente para contas de cliente.' });
    }

    const requestId = Number(req.params.id);
    const token = normalizeText(req.body?.token || req.headers['x-client-request-token'], 80);

    if (!Number.isInteger(requestId) || requestId <= 0 || token.length < 32) {
      return res.status(400).json({ error: 'Código do pedido ou acesso inválido.' });
    }

    const result = await pool.query(
      `
        UPDATE service_requests
        SET client_user_id = $1, updated_at = NOW()
        WHERE id = $2
          AND client_access_token = $3
          AND (client_user_id IS NULL OR client_user_id = $1)
        RETURNING *
      `,
      [req.userId, requestId, token]
    );
    const request = result.rows[0];

    if (!request) {
      return res.status(404).json({ error: 'Pedido não encontrado ou já vinculado a outra conta.' });
    }

    const interestResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM service_request_interests
        WHERE request_id = $1 AND status IN ('interested', 'selected')
      `,
      [requestId]
    );
    const interestsCount = Number(interestResult.rows[0]?.total || 0);

    if (interestsCount > 0) {
      await pool.query(
        `
          INSERT INTO notifications (user_id, title, message, type, read)
          SELECT $1, 'Pedido vinculado', $2, 'info', FALSE
          WHERE NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE user_id = $1 AND title = 'Pedido vinculado' AND message = $2
          )
        `,
        [req.userId, `Seu pedido #${requestId} tem ${interestsCount} interessado(s).`]
      );
    }

    return res.json({
      service_request: {
        ...serializeClientRequest({ ...request, interests_count: interestsCount }),
        tracking_url: buildTrackingUrl(req, request),
      },
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Não foi possível vincular o pedido à sua conta.' });
  }
};

exports.uploadPublicRequestPhoto = async (req, res) => {
  try {
    if (!req.file || !String(req.file.mimetype || '').startsWith('image/')) {
      return res.status(400).json({ error: 'Selecione uma imagem PNG, JPG ou WEBP.' });
    }

    const validation = validateUploadFile(req.file, { allowPdf: false });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }

    req.file.mimetype = validation.mimeType;

    const ipHash = crypto
      .createHash('sha256')
      .update(String(req.ip || 'anonymous'))
      .digest('hex')
      .slice(0, 20);
    const stored = await storeProfileAsset({
      userId: `client-${ipHash}`,
      kind: 'request-photo',
      file: req.file,
    });
    return res.status(201).json({ ...stored, url: publicAssetUrl(stored.pathname) });
  } catch (error) {
    if (error.code === 'OBJECT_STORAGE_NOT_CONFIGURED') {
      return res.status(503).json({ error: error.message, code: error.code });
    }
    return res.status(500).json({ error: 'Não foi possível armazenar a foto do pedido.' });
  }
};

exports.getOpportunities = async (req, res) => {
  try {
    const installer = await getInstaller(req.userId);

    if (!installer) {
      return res.status(403).json({ error: 'Acesso restrito a instaladores.' });
    }

    if (!installer.is_admin && (!installer.city || !installer.state)) {
      return res.status(403).json({
        error: 'Informe cidade e estado no perfil para ver pedidos da sua região.',
        code: 'PROFILE_LOCATION_REQUIRED',
      });
    }

    const rawStatus = normalizeText(req.query.status, 20);
    const status = ['interested', 'selected', 'all'].includes(rawStatus) ? rawStatus : 'open';
    const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 100);
    const city = normalizeOptionalText(req.query.city, 120) || installer.city || '';
    const state = normalizeState(req.query.state) || normalizeState(installer.state);
    const normalizedInstallerCity = normalizeSearchText(installer.city);
    const normalizedInstallerState = normalizeSearchText(installer.state);
    const normalizedCity = normalizeSearchText(city);
    const normalizedState = normalizeSearchText(state);
    const hasInstallerCoordinates = [installer.latitude, installer.longitude].every(
      (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    );
    const serviceRadiusKm = Math.min(Math.max(Number(installer.service_radius_km) || 80, 10), 250);
    const values = [
      req.userId,
      normalizedInstallerCity,
      normalizedInstallerState,
      normalizedCity,
      normalizedState,
      limit,
      hasInstallerCoordinates,
    ];
    const filters = [];

    if (status === 'selected') {
      filters.push("sri.status = 'selected'");
    } else {
      filters.push("sr.status = 'open'");
      filters.push('(sr.expires_at IS NULL OR sr.expires_at > NOW())');

      if (status === 'interested') {
        filters.push("sri.status = 'interested'");
      } else if (status === 'open') {
        filters.push('sri.id IS NULL');
      }
    }

    filters.push(
      "($4 = '' OR $7::boolean = TRUE OR TRANSLATE(LOWER(COALESCE(sr.city, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy') = $4)"
    );

    if (state) {
      filters.push("TRANSLATE(LOWER(COALESCE(sr.state, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy') = $5");
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
            WHEN TRANSLATE(LOWER(COALESCE(sr.city, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy') = NULLIF($2, '')
              AND TRANSLATE(LOWER(COALESCE(sr.state, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy') = NULLIF($3, '') THEN 100
            WHEN TRANSLATE(LOWER(COALESCE(sr.state, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy') = NULLIF($3, '') THEN 82
            WHEN NULLIF(sr.state, '') IS NULL OR NULLIF($3, '') IS NULL THEN 64
            ELSE 38
          END AS match_score,
          CASE
            WHEN TRANSLATE(LOWER(COALESCE(sr.city, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy') = NULLIF($2, '')
              AND TRANSLATE(LOWER(COALESCE(sr.state, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy') = NULLIF($3, '') THEN 'Mesma cidade'
            WHEN TRANSLATE(LOWER(COALESCE(sr.state, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy') = NULLIF($3, '') THEN 'Mesmo estado'
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

    const opportunities = result.rows
      .map((row) => {
        const distanceKm = haversineDistanceKm(
          installer.latitude,
          installer.longitude,
          row.latitude,
          row.longitude
        );
        return {
          ...row,
          distance_km: distanceKm,
          distance_label: distanceKm === null ? row.distance_label : `${Math.max(1, Math.round(distanceKm))} km de distancia`,
        };
      })
      .filter((row) => {
        if (!hasInstallerCoordinates || row.selected_by_me || row.interested_by_me) return true;
        const sameCity = normalizeSearchText(row.city) === normalizedInstallerCity;
        return sameCity || (row.distance_km !== null && row.distance_km <= serviceRadiusKm);
      })
      .sort((left, right) => {
        if (left.selected_by_me !== right.selected_by_me) return left.selected_by_me ? -1 : 1;
        if (left.interested_by_me !== right.interested_by_me) return left.interested_by_me ? -1 : 1;
        if (left.distance_km === null) return 1;
        if (right.distance_km === null) return -1;
        return left.distance_km - right.distance_km;
      })
      .slice(0, limit)
      .map((row) => {
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
      eligibility: {
        can_express_interest: Boolean(
          installer.is_admin || (installer.certification_verified && installer.public_profile)
        ),
        certification_verified: Boolean(installer.certification_verified),
        public_profile: Boolean(installer.public_profile),
        requirement_code: installer.is_admin || (installer.certification_verified && installer.public_profile)
          ? null
          : !installer.certification_verified
            ? 'CERTIFICATION_REQUIRED'
            : 'PUBLIC_PROFILE_REQUIRED',
        message: installer.is_admin || (installer.certification_verified && installer.public_profile)
          ? ''
          : !installer.certification_verified
            ? 'Você pode ver pedidos, mas só poderá enviar interesse após a validação do certificado.'
            : 'Você pode ver pedidos, mas precisa publicar o perfil antes de enviar interesse.',
      },
      stats: {
        open: opportunities.filter((item) => !item.interested_by_me && item.status === 'open').length,
        interested: opportunities.filter((item) => item.my_interest_status === 'interested').length,
        selected: opportunities.filter((item) => item.selected_by_me).length,
        matched: opportunities.filter((item) => item.match_score >= 82).length,
      },
    });
  } catch (error) {
    console.error('Falha ao carregar oportunidades:', error);
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

    if (!installer.is_admin && (!installer.certification_verified || !installer.public_profile)) {
      return res.status(403).json({
        error: !installer.certification_verified
          ? 'Seu certificado precisa ser validado antes de enviar interesse.'
          : 'Publique seu perfil antes de enviar interesse.',
        code: !installer.certification_verified ? 'CERTIFICATION_REQUIRED' : 'PUBLIC_PROFILE_REQUIRED',
      });
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
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `,
      [requestId]
    );
    const request = requestResult.rows[0];

    if (!request) {
      return res.status(404).json({ error: 'Oportunidade nao encontrada ou ja encerrada.' });
    }

    if (!installer.is_admin) {
      const sameState = !installer.state || normalizeSearchText(installer.state) === normalizeSearchText(request.state);
      const sameCity = !installer.city || normalizeSearchText(installer.city) === normalizeSearchText(request.city);
      const distanceKm = haversineDistanceKm(
        installer.latitude,
        installer.longitude,
        request.latitude,
        request.longitude
      );
      const serviceRadiusKm = Math.min(Math.max(Number(installer.service_radius_km) || 80, 10), 250);
      const withinServiceRadius = distanceKm !== null && distanceKm <= serviceRadiusKm;

      if (!withinServiceRadius && (!sameState || !sameCity)) {
        return res.status(403).json({
          error: 'Este pedido não pertence à região informada no seu perfil.',
          code: 'REGION_MISMATCH',
        });
      }
    }

    const interestInsert = await pool.query(
      `
        INSERT INTO service_request_interests (request_id, installer_id, status)
        VALUES ($1, $2, 'interested')
        ON CONFLICT (request_id, installer_id)
        DO NOTHING
        RETURNING id
      `,
      [requestId, req.userId]
    );

    const isNewInterest = interestInsert.rowCount > 0;

    if (!isNewInterest) {
      await pool.query(
        `
          UPDATE service_request_interests
          SET
            status = CASE WHEN status = 'selected' THEN 'selected' ELSE 'interested' END,
            updated_at = NOW()
          WHERE request_id = $1 AND installer_id = $2
        `,
        [requestId, req.userId]
      );
    } else {
      await pool.query('UPDATE service_requests SET last_interest_at = NOW(), updated_at = NOW() WHERE id = $1', [requestId]);

      if (request.client_user_id) {
        await pool.query(
          `
            INSERT INTO notifications (user_id, title, message, type, read)
            VALUES ($1, $2, $3, 'info', FALSE)
          `,
          [
            request.client_user_id,
            'Novo instalador interessado',
            `${installer.business_name || installer.name || 'Um instalador'} demonstrou interesse no seu pedido.`,
          ]
        );
      }

      if (request.client_email) {
        const emailResult = await sendServiceRequestInterestEmail({
          to: request.client_email,
          clientName: request.client_name,
          installerName: installer.business_name || installer.name,
          serviceLabel: request.service_label,
          trackingUrl: buildTrackingUrl(req, request),
        }).catch((error) => {
          console.error('Falha ao enviar aviso de novo interesse:', error.message);
          return { sent: false };
        });

        if (emailResult.sent) {
          await pool.query(
            `
              UPDATE service_request_interests
              SET client_notified_at = NOW(), updated_at = NOW()
              WHERE request_id = $1 AND installer_id = $2
            `,
            [requestId, req.userId]
          );
        }
      }
    }

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
    const token = normalizeText(req.headers['x-client-request-token'], 80);

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
          AND (COALESCE(u.certification_verified, FALSE) = TRUE OR COALESCE(u.is_admin, FALSE) = TRUE)
          AND (COALESCE(u.public_profile, FALSE) = TRUE OR COALESCE(u.is_admin, FALSE) = TRUE)
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
  let client;

  try {
    client = await pool.connect();
    const requestId = Number(req.params.id);
    const interestId = Number(req.params.interestId);
    const token = normalizeText(req.headers['x-client-request-token'], 80);

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

    if (!['open', 'selected'].includes(request.status) || (request.expires_at && new Date(request.expires_at) <= new Date())) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este pedido já foi encerrado e não aceita seleção.' });
    }

    const interestResult = await client.query(
      `
        SELECT sri.*, u.phone, u.name, u.business_name, COALESCE(NULLIF(u.business_name, ''), u.name) AS display_name
        FROM service_request_interests sri
        JOIN users u ON u.id = sri.installer_id
        WHERE sri.id = $1
          AND sri.request_id = $2
          AND sri.status IN ('interested', 'selected')
          AND u.deleted_at IS NULL
          AND (COALESCE(u.is_admin, FALSE) = TRUE OR (
            COALESCE(u.certification_verified, FALSE) = TRUE
            AND COALESCE(u.public_profile, FALSE) = TRUE
          ))
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
    await client?.query('ROLLBACK').catch(() => null);
    return res.status(500).json({ error: 'Nao foi possivel escolher o instalador.' });
  } finally {
    client?.release();
  }
};

exports.updateClientServiceRequestStatus = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const nextStatus = normalizeText(req.body?.status, 20).toLowerCase();
    const token = normalizeText(req.headers['x-client-request-token'], 80);
    const clientUserId = req.user?.account_type === 'client' ? Number(req.userId) : null;

    if (!Number.isInteger(requestId) || requestId <= 0 || !['canceled', 'closed'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Pedido ou status invalido.' });
    }

    if (!clientUserId && token.length < 32) {
      return res.status(401).json({ error: 'Entre na conta ou informe o codigo de acesso do pedido.' });
    }

    const currentResult = await pool.query(
      `
        SELECT *
        FROM service_requests
        WHERE id = $1
          AND (
            ($2::int IS NOT NULL AND client_user_id = $2)
            OR ($3 <> '' AND client_access_token = $3)
          )
        LIMIT 1
      `,
      [requestId, clientUserId, token]
    );
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ error: 'Pedido nao encontrado ou acesso invalido.' });
    }

    if (nextStatus === 'closed' && current.status !== 'selected') {
      return res.status(409).json({ error: 'Escolha um instalador antes de concluir o pedido.' });
    }

    if (!['open', 'selected'].includes(current.status)) {
      return res.status(409).json({ error: 'Este pedido ja foi encerrado.' });
    }

    const result = await pool.query(
      `
        UPDATE service_requests
        SET
          status = $1::varchar,
          completed_at = CASE WHEN $1::varchar = 'closed' THEN NOW() ELSE completed_at END,
          canceled_at = CASE WHEN $1::varchar = 'canceled' THEN NOW() ELSE canceled_at END,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [nextStatus, requestId]
    );

    if (current.selected_installer_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, read)
         VALUES ($1, $2, $3, $4, FALSE)`,
        [
          current.selected_installer_id,
          nextStatus === 'closed' ? 'Servico concluido pelo cliente' : 'Pedido cancelado pelo cliente',
          nextStatus === 'closed'
            ? `O cliente marcou o pedido #${requestId} como concluido.`
            : `O cliente cancelou o pedido #${requestId}.`,
          nextStatus === 'closed' ? 'success' : 'info',
        ]
      );
    }

    return res.json({ request: serializeClientRequest(result.rows[0]) });
  } catch (error) {
    console.error('Falha ao atualizar status do pedido:', error);
    return res.status(500).json({ error: 'Nao foi possivel atualizar o pedido.' });
  }
};
