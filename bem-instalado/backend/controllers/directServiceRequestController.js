const crypto = require('crypto');
const pool = require('../config/database');
const { normalizeBrazilianWhatsApp, getInstallerReadiness } = require('../utils/installerEligibility');
const {
  buildInstallerClientLink, getLinkInstaller, hasActiveClientLinkPlan, mayUseClientLink, readInstallerLinkToken,
} = require('../services/installerClientLink');
const { BRAZIL_STATES } = require('../utils/postalAddress');
const { consentVersion } = require('../../shared/legalDocuments.json');
const linkContract = require('../../shared/installerClientLink.json');

const text = (value) => typeof value === 'string' ? value.trim() : '';
const validId = (value) => Number.isInteger(value) && value > 0 && value <= 2147483647;

exports.getOwnClientLink = async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const installer = await getLinkInstaller(req.userId);
    if (!installer) return res.status(404).json({ error: 'Perfil de instalador não encontrado.' });
    if (!(await hasActiveClientLinkPlan(installer.id))) {
      return res.json({ status: linkContract.status.planRequired, url: null });
    }
    if (!getInstallerReadiness(installer).ready) {
      return res.json({ status: linkContract.status.incomplete, url: null });
    }
    return res.json({ status: linkContract.status.ready, url: buildInstallerClientLink(installer) });
  } catch (_error) {
    return res.status(500).json({ error: 'Não foi possível carregar o link para clientes.' });
  }
};

exports.create = async (req, res) => {
  const installerId = Number(req.params.id);
  const input = req.body || {};
  const name = text(input.client_name);
  const phone = normalizeBrazilianWhatsApp(text(input.client_phone));
  const city = text(input.city);
  const state = text(input.state).toUpperCase();
  const details = text(input.details);
  const clientId = req.user?.account_type === 'client' ? req.userId : null;
  const linkToken = readInstallerLinkToken(req);

  if (!validId(installerId) || req.userId === installerId) return res.status(400).json({ error: 'Escolha outro instalador para enviar o pedido.' });
  if (name.length < 2 || name.length > 120 || !phone) return res.status(400).json({ error: 'Informe um nome e um WhatsApp brasileiro válido, com DDD.' });
  if (city.length < 2 || city.length > 120 || !BRAZIL_STATES.has(state)) return res.status(400).json({ error: 'Informe a cidade e selecione o estado da instalação.' });
  if (!details || details.length > 800) return res.status(400).json({ error: 'Descreva o que você precisa em até 800 caracteres.' });
  if (input.privacy_consent !== true) return res.status(400).json({ error: 'Confirme o envio dos seus dados apenas para este instalador.' });

  let db;
  try {
    db = await pool.connect();
    await db.query('BEGIN');
    const installer = await getLinkInstaller(installerId, db, { lock: true });
    if (!(await mayUseClientLink(installer, linkToken, db))) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Este perfil não está disponível para receber pedidos diretos.' });
    }

    const { rows: [request] } = await db.query(
      `INSERT INTO service_requests (
         direct_installer_id, client_user_id, client_name, client_phone, city, state, details,
         service, service_label, status, client_access_token, privacy_consent_at, terms_version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'wallpaper', 'Instalação de papel de parede', 'direct_pending', $8, NOW(), $9)
       RETURNING id, client_access_token, expires_at`,
      [installerId, clientId, name, phone, city, state, details, crypto.randomBytes(24).toString('hex'), consentVersion],
    );
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, read, action_path)
       VALUES ($1, 'Pedido direto recebido', $2, 'info', FALSE, '/opportunities')`,
      [installerId, `Você recebeu o pedido #${request.id} pelo link do seu perfil. Veja os detalhes em Oportunidades.`],
    );
    await db.query('COMMIT');
    res.set('Cache-Control', 'private, no-store');
    return res.status(201).json({ service_request: { ...request, is_direct: true, status: 'open' } });
  } catch (_error) {
    await db?.query('ROLLBACK').catch(() => null);
    return res.status(500).json({ error: 'Não foi possível enviar este pedido direto. Tente novamente.' });
  } finally {
    db?.release();
  }
};

exports.accept = async (req, res) => {
  const requestId = Number(req.params.id);
  if (!validId(requestId)) return res.status(400).json({ error: 'Pedido inválido.' });
  let db;
  try {
    db = await pool.connect();
    await db.query('BEGIN');
    const { rows: [request] } = await db.query(
      `SELECT status, selected_installer_id, expires_at <= NOW() AS expired
       FROM service_requests WHERE id = $1 AND direct_installer_id = $2 FOR UPDATE`,
      [requestId, req.userId],
    );
    if (!request) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido direto não encontrado.' });
    }

    if (request.status !== 'direct_pending' || request.expired) {
      const { rows: [draft] } = request.status === 'selected' && request.selected_installer_id === req.userId
        ? await db.query('SELECT id FROM budgets WHERE source_service_request_id = $1 AND user_id = $2', [requestId, req.userId])
        : { rows: [] };
      await db.query('COMMIT');
      if (draft) return res.json({ budget_id: draft.id });
      return res.status(409).json({ error: 'Este pedido direto não está mais disponível para aceite.' });
    }

    await db.query(
      `UPDATE service_requests SET status = 'selected', selected_installer_id = $2, selected_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND direct_installer_id = $2`,
      [requestId, req.userId],
    );
    await db.query(
      "INSERT INTO service_request_interests (request_id, installer_id, status) VALUES ($1, $2, 'selected')",
      [requestId, req.userId],
    );
    const { rows: [draft] } = await db.query(
      "INSERT INTO budgets (user_id, source_service_request_id, status) VALUES ($1, $2, 'draft') RETURNING id",
      [req.userId, requestId],
    );
    await db.query('COMMIT');
    return res.json({ budget_id: draft.id });
  } catch (_error) {
    await db?.query('ROLLBACK').catch(() => null);
    return res.status(500).json({ error: 'Não foi possível aceitar este pedido direto. Tente novamente.' });
  } finally {
    db?.release();
  }
};
