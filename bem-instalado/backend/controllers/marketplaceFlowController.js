const pool = require('../config/database');
const { sendMarketplaceEmail } = require('../services/email');
const { sendPushToUser } = require('../services/push');
const { notifyOperationalAlert } = require('../services/operationalAlerts');
const { logApplicationError } = require('../utils/errorMonitoring');

function text(value, max = 2000) {
  return String(value || '').trim().slice(0, max);
}

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000000 ? Math.round(parsed * 100) / 100 : null;
}

function date(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clientToken(req) {
  return text(req.headers['x-client-request-token'] || req.body?.token, 100);
}

function appUrl(req, path) {
  const configured = text(process.env.FRONTEND_URL || process.env.APP_URL, 1000);
  if (configured) return `${configured.replace(/\/+$/, '')}${path}`;
  const protocol = text(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
  const host = text(req.headers['x-forwarded-host'] || req.get('host')).split(',')[0];
  return host ? `${protocol}://${host}${path}` : path;
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function serializeProposal(row) {
  if (!row) return null;
  return {
    id: row.id,
    service_request_id: row.service_request_id,
    installer_id: row.installer_id,
    installer_name: row.installer_name || null,
    amount: Number(row.amount || 0),
    currency: row.currency || 'BRL',
    scope: row.scope,
    materials: row.materials || null,
    notes: row.notes || null,
    scheduled_start: row.scheduled_start,
    scheduled_end: row.scheduled_end,
    status: row.status,
    client_response_message: row.client_response_message || null,
    sent_at: row.sent_at,
    responded_at: row.responded_at,
    accepted_at: row.accepted_at,
    booking_status: row.booking_status || null,
  };
}

async function loadClientRequest(db, req, requestId, { lock = false } = {}) {
  const token = clientToken(req);
  const authenticatedClientId = req.user?.account_type === 'client' ? Number(req.userId) : null;
  if (!token && !authenticatedClientId) return null;

  const result = await db.query(
    `SELECT * FROM service_requests
     WHERE id = $1
       AND (($2::int IS NOT NULL AND client_user_id = $2) OR ($3 <> '' AND client_access_token = $3))
     ${lock ? 'FOR UPDATE' : ''}`,
    [requestId, authenticatedClientId, token]
  );
  return result.rows[0] || null;
}

async function loadInstallerRequest(db, installerId, requestId, { lock = false } = {}) {
  const result = await db.query(
    `SELECT sr.*, u.email AS client_account_email
     FROM service_requests sr
     LEFT JOIN users u ON u.id = sr.client_user_id
     WHERE sr.id = $1 AND sr.selected_installer_id = $2
     ${lock ? 'FOR UPDATE OF sr' : ''}`,
    [requestId, installerId]
  );
  return result.rows[0] || null;
}

async function createNotification(db, userId, title, message, type = 'info') {
  if (!userId) return;
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, read)
     VALUES ($1, $2, $3, $4, FALSE)`,
    [userId, title, message, type]
  );
}

async function emailSafely(payload) {
  await sendMarketplaceEmail(payload).catch((error) => {
    console.error('Falha ao enviar e-mail do marketplace:', error.message);
    void notifyOperationalAlert({
      severity: 'error',
      source: 'marketplace-email',
      message: 'Falha ao enviar e-mail transacional do marketplace.',
    });
  });
}

async function reportFailure(error, req) {
  // Logging also uses the pool: callers must release their transaction first.
  await logApplicationError({
    message: 'Falha no fluxo de proposta ou agendamento.',
    stack: error.stack,
    metadata: { errorCode: error.code || 'UNEXPECTED_ERROR' },
    source: 'marketplace-flow',
    req: { method: req.method, originalUrl: req.path, userId: req.userId },
  }).catch(() => null);
}

exports.getInstallerProposal = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ error: 'Pedido inválido.' });
    const request = await loadInstallerRequest(pool, req.userId, requestId);
    if (!request) return res.status(404).json({ error: 'Pedido selecionado não encontrado.' });
    const proposal = await pool.query(
      `SELECT sp.*, sb.status AS booking_status
       FROM service_proposals sp
       LEFT JOIN service_bookings sb ON sb.proposal_id = sp.id
       WHERE sp.service_request_id = $1`,
      [requestId]
    );
    return res.json({ proposal: serializeProposal(proposal.rows[0]), request_status: request.status });
  } catch (_error) {
    return res.status(500).json({ error: 'Não foi possível carregar a proposta.' });
  }
};

exports.sendProposal = async (req, res) => {
  let db;
  try {
    const requestId = Number(req.params.id);
    const proposalAmount = amount(req.body?.amount);
    const scope = text(req.body?.scope, 3000);
    const materials = text(req.body?.materials, 2000);
    const notes = text(req.body?.notes, 2000);
    const scheduledStart = date(req.body?.scheduled_start);
    const scheduledEnd = date(req.body?.scheduled_end);

    if (!Number.isInteger(requestId) || requestId <= 0 || proposalAmount === null || !scope || !scheduledStart || !scheduledEnd) {
      return res.status(400).json({ error: 'Informe preço, descrição e um horário válido para a proposta.' });
    }
    if (scheduledEnd <= scheduledStart || scheduledStart <= new Date()) {
      return res.status(400).json({ error: 'O agendamento deve começar no futuro e terminar após o horário inicial.' });
    }

    db = await pool.connect();
    await db.query('BEGIN');
    const request = await loadInstallerRequest(db, req.userId, requestId, { lock: true });
    if (!request) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido selecionado não encontrado.' });
    }
    if (!['selected', 'proposal_sent'].includes(request.status)) {
      await db.query('ROLLBACK');
      return res.status(409).json({ error: 'Este pedido não aceita uma nova proposta neste momento.' });
    }

    const proposalResult = await db.query(
      `INSERT INTO service_proposals (
         service_request_id, installer_id, amount, scope, materials, notes, scheduled_start, scheduled_end, status, sent_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', NOW(), NOW())
       ON CONFLICT (service_request_id) DO UPDATE
       SET amount = EXCLUDED.amount,
           scope = EXCLUDED.scope,
           materials = EXCLUDED.materials,
           notes = EXCLUDED.notes,
           scheduled_start = EXCLUDED.scheduled_start,
           scheduled_end = EXCLUDED.scheduled_end,
           status = 'sent',
           client_response_message = NULL,
           sent_at = NOW(),
           responded_at = NULL,
           accepted_at = NULL,
           updated_at = NOW()
       WHERE service_proposals.status IN ('sent', 'change_requested', 'rejected', 'canceled')
       RETURNING *`,
      [requestId, req.userId, proposalAmount, scope, materials || null, notes || null, scheduledStart, scheduledEnd]
    );
    const proposal = proposalResult.rows[0];
    if (!proposal) {
      await db.query('ROLLBACK');
      return res.status(409).json({ error: 'A proposta já foi aceita e não pode ser alterada.' });
    }

    await db.query(`UPDATE service_requests SET status = 'proposal_sent', updated_at = NOW() WHERE id = $1`, [requestId]);
    await createNotification(
      db,
      request.client_user_id,
      'Nova proposta recebida',
      `O instalador enviou uma proposta de ${formatMoney(proposal.amount)} para o pedido #${requestId}.`,
      'info'
    );
    await db.query('COMMIT');
    db.release();
    db = null;

    await emailSafely({
      to: request.client_account_email || request.client_email,
      subject: 'Nova proposta para seu pedido - InstalaPro',
      title: 'Nova proposta recebida',
      body: `Você recebeu uma proposta de ${formatMoney(proposal.amount)}. Confira os detalhes e aceite ou peça ajustes.`,
      actionLabel: 'Ver proposta',
      actionUrl: appUrl(req, '/cliente/pedidos'),
    });
    await sendPushToUser({
      userId: request.client_user_id,
      title: 'Nova proposta recebida',
      body: `Há uma proposta de ${formatMoney(proposal.amount)} para seu pedido.`,
      data: { route: '/cliente/pedidos', requestId },
    }).catch(() => null);

    return res.status(201).json({ proposal: serializeProposal(proposal) });
  } catch (error) {
    await db?.query('ROLLBACK').catch(() => null);
    db?.release();
    db = null;
    await reportFailure(error, req);
    return res.status(500).json({ error: 'Não foi possível enviar a proposta.' });
  } finally {
    db?.release();
  }
};

exports.getClientProposal = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ error: 'Pedido inválido.' });
    const request = await loadClientRequest(pool, req, requestId);
    if (!request) return res.status(404).json({ error: 'Pedido não encontrado ou acesso inválido.' });

    const result = await pool.query(
      `SELECT sp.*, COALESCE(NULLIF(u.business_name, ''), u.name) AS installer_name, sb.status AS booking_status
       FROM service_proposals sp
       JOIN users u ON u.id = sp.installer_id
       LEFT JOIN service_bookings sb ON sb.proposal_id = sp.id
       WHERE sp.service_request_id = $1`,
      [requestId]
    );
    return res.json({ proposal: serializeProposal(result.rows[0]), request_status: request.status });
  } catch (_error) {
    return res.status(500).json({ error: 'Não foi possível carregar a proposta.' });
  }
};

exports.respondToProposal = async (req, res) => {
  let db;
  try {
    const requestId = Number(req.params.id);
    const decision = text(req.body?.decision, 40).toLowerCase();
    const message = text(req.body?.message, 1000);
    if (!Number.isInteger(requestId) || requestId <= 0 || !['accept', 'request_changes', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Resposta à proposta inválida.' });
    }

    db = await pool.connect();
    await db.query('BEGIN');
    const request = await loadClientRequest(db, req, requestId, { lock: true });
    if (!request) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido não encontrado ou acesso inválido.' });
    }
    const proposalResult = await db.query(
      `SELECT * FROM service_proposals WHERE service_request_id = $1 FOR UPDATE`,
      [requestId]
    );
    const proposal = proposalResult.rows[0];
    const decisionStatus = { accept: 'accepted', request_changes: 'change_requested', reject: 'rejected' }[decision];
    if (proposal?.status === decisionStatus && (decision === 'accept' || (proposal.client_response_message || '') === message)) {
      const fresh = await db.query(
        `SELECT sp.*, sb.status AS booking_status FROM service_proposals sp LEFT JOIN service_bookings sb ON sb.proposal_id = sp.id WHERE sp.id = $1`,
        [proposal.id]
      );
      await db.query('COMMIT');
      return res.json({ proposal: serializeProposal(fresh.rows[0]), request_status: request.status });
    }
    if (!proposal || !['sent', 'change_requested'].includes(proposal.status)) {
      await db.query('ROLLBACK');
      return res.status(409).json({ error: 'Não há uma proposta pendente para responder.' });
    }
    if (!['selected', 'proposal_sent'].includes(request.status)) {
      await db.query('ROLLBACK');
      return res.status(409).json({ error: 'Este pedido já foi encerrado ou não aceita respostas.', code: 'REQUEST_NOT_ACTIVE' });
    }

    if (decision === 'accept') {
      if (new Date(proposal.scheduled_start) <= new Date()) {
        await db.query(`UPDATE service_proposals SET status = 'change_requested', client_response_message = $2, responded_at = NOW(), updated_at = NOW() WHERE id = $1`, [proposal.id, 'O horário da proposta já passou. Envie uma nova opção.']);
        await db.query("UPDATE service_requests SET status = 'selected', updated_at = NOW() WHERE id = $1", [requestId]);
        await db.query('COMMIT');
        return res.status(409).json({ error: 'O horário da proposta já passou. Peça uma nova opção ao instalador.', code: 'PROPOSAL_TIME_EXPIRED' });
      }
      // Shared transaction-level PostgreSQL lock with the legacy budget scheduler.
      await db.query('SELECT pg_advisory_xact_lock($1)', [proposal.installer_id]);
      const overlap = await db.query(
        `SELECT id FROM service_bookings
         WHERE installer_id = $1
           AND status IN ('scheduled', 'in_progress')
           AND scheduled_start < $3
           AND scheduled_end > $2
         FOR UPDATE`,
        [proposal.installer_id, proposal.scheduled_start, proposal.scheduled_end]
      );
      if (overlap.rowCount) {
        await db.query(`UPDATE service_proposals SET status = 'change_requested', client_response_message = $2, responded_at = NOW(), updated_at = NOW() WHERE id = $1`, [proposal.id, 'O horário foi ocupado antes da confirmação. Envie uma nova opção.']);
        await db.query('UPDATE service_requests SET status = \'selected\', updated_at = NOW() WHERE id = $1', [requestId]);
        await db.query('COMMIT');
        return res.status(409).json({ error: 'Esse horário acabou de ficar indisponível. Peça uma nova opção ao instalador.' });
      }

      const manualOverlap = await db.query(
        `SELECT id FROM schedules
         WHERE user_id = $1
           AND status = 'scheduled'
           AND date >= $2
           AND date < $3
         FOR UPDATE`,
        [proposal.installer_id, proposal.scheduled_start, proposal.scheduled_end]
      );
      if (manualOverlap.rowCount) {
        await db.query(
          `UPDATE service_proposals
           SET status = 'change_requested', client_response_message = $2, responded_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [proposal.id, 'O horário foi ocupado na agenda antes da confirmação. Envie uma nova opção.']
        );
        await db.query("UPDATE service_requests SET status = 'selected', updated_at = NOW() WHERE id = $1", [requestId]);
        await db.query('COMMIT');
        return res.status(409).json({
          error: 'Esse horário acabou de ficar indisponível. Peça uma nova opção ao instalador.',
          code: 'BOOKING_TIME_CONFLICT',
        });
      }

      await db.query(
        `INSERT INTO service_bookings (service_request_id, proposal_id, installer_id, scheduled_start, scheduled_end, status)
         VALUES ($1, $2, $3, $4, $5, 'scheduled')`,
        [requestId, proposal.id, proposal.installer_id, proposal.scheduled_start, proposal.scheduled_end]
      );
      await db.query(
        `UPDATE service_proposals SET status = 'accepted', client_response_message = $2, responded_at = NOW(), accepted_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [proposal.id, message || null]
      );
      await db.query(`UPDATE service_requests SET status = 'scheduled', updated_at = NOW() WHERE id = $1`, [requestId]);
    } else {
      const nextStatus = decision === 'request_changes' ? 'change_requested' : 'rejected';
      await db.query(
        `UPDATE service_proposals SET status = $2, client_response_message = $3, responded_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [proposal.id, nextStatus, message || null]
      );
      await db.query(`UPDATE service_requests SET status = 'selected', updated_at = NOW() WHERE id = $1`, [requestId]);
    }

    const title = decision === 'accept' ? 'Proposta aceita' : decision === 'request_changes' ? 'Cliente pediu ajustes' : 'Proposta recusada';
    const notification = decision === 'accept'
      ? `O cliente aceitou a proposta do pedido #${requestId}. O horário está confirmado.`
      : `O cliente respondeu à proposta do pedido #${requestId}.${message ? ` Mensagem: ${message}` : ''}`;
    await createNotification(db, proposal.installer_id, title, notification, decision === 'accept' ? 'success' : 'info');
    const fresh = await db.query(`SELECT sp.*, sb.status AS booking_status FROM service_proposals sp LEFT JOIN service_bookings sb ON sb.proposal_id = sp.id WHERE sp.id = $1`, [proposal.id]);
    const installerResult = await db.query('SELECT email FROM users WHERE id = $1', [proposal.installer_id]);
    await db.query('COMMIT');
    db.release();
    db = null;
    await emailSafely({
      to: installerResult.rows[0]?.email,
      subject: `${title} - InstalaPro`,
      title,
      body: notification,
      actionLabel: 'Abrir oportunidade',
      actionUrl: appUrl(req, '/opportunities'),
    });
    await sendPushToUser({
      userId: proposal.installer_id,
      title: decision === 'accept' ? 'Proposta aceita' : 'Cliente respondeu à proposta',
      body: decision === 'accept' ? 'O horário está confirmado na sua agenda.' : 'Abra a oportunidade para conferir a resposta.',
      data: { route: '/opportunities', requestId },
    }).catch(() => null);
    return res.json({ proposal: serializeProposal(fresh.rows[0]), request_status: decision === 'accept' ? 'scheduled' : 'selected' });
  } catch (error) {
    await db?.query('ROLLBACK').catch(() => null);
    db?.release();
    db = null;
    if (error.code === '23P01') {
      return res.status(409).json({
        error: 'Esse horário acabou de ficar indisponível. Peça uma nova opção ao instalador.',
        code: 'BOOKING_TIME_CONFLICT',
      });
    }
    await reportFailure(error, req);
    return res.status(500).json({ error: 'Não foi possível registrar sua resposta.' });
  } finally {
    db?.release();
  }
};

exports.updateServiceProgress = async (req, res) => {
  let db;
  try {
    const requestId = Number(req.params.id);
    const status = text(req.body?.status, 40).toLowerCase();
    if (!Number.isInteger(requestId) || requestId <= 0 || !['in_progress', 'completed', 'canceled'].includes(status)) {
      return res.status(400).json({ error: 'Status do serviço inválido.' });
    }

    db = await pool.connect();
    await db.query('BEGIN');
    const request = await loadInstallerRequest(db, req.userId, requestId, { lock: true });
    if (!request) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Serviço não encontrado.' });
    }
    const bookingResult = await db.query(
      `UPDATE service_bookings SET status = $2::text, updated_at = NOW()
       WHERE service_request_id = $1 AND installer_id = $3
         AND (($2 = 'in_progress' AND status = 'scheduled') OR ($2 IN ('completed', 'canceled') AND status IN ('scheduled', 'in_progress')))
       RETURNING *`,
      [requestId, status, req.userId]
    );
    if (!bookingResult.rows[0]) {
      const current = await db.query('SELECT * FROM service_bookings WHERE service_request_id = $1 AND installer_id = $2 AND status = $3', [requestId, req.userId, status]);
      await db.query('ROLLBACK');
      if (current.rows[0]) return res.json({ booking: current.rows[0], request_status: request.status });
      return res.status(409).json({ error: 'Esta alteração não é válida para o estado atual do agendamento.' });
    }
    const requestStatus = status === 'completed' ? 'closed' : status === 'canceled' ? 'canceled' : 'in_progress';
    await db.query(
      `UPDATE service_requests
       SET status = $2::text,
           completed_at = CASE WHEN $2::text = 'closed' THEN NOW() ELSE completed_at END,
           canceled_at = CASE WHEN $2::text = 'canceled' THEN NOW() ELSE canceled_at END,
           updated_at = NOW()
       WHERE id = $1`,
      [requestId, requestStatus]
    );
    const title = status === 'in_progress' ? 'Serviço em andamento' : status === 'completed' ? 'Serviço concluído' : 'Serviço cancelado';
    await createNotification(db, request.client_user_id, title, `O instalador atualizou o pedido #${requestId}.`, status === 'completed' ? 'success' : 'info');
    await db.query('COMMIT');
    db.release();
    db = null;
    await emailSafely({
      to: request.client_account_email || request.client_email,
      subject: `${title} - InstalaPro`,
      title,
      body: `O instalador atualizou o pedido #${requestId}.`,
      actionLabel: 'Ver pedido',
      actionUrl: appUrl(req, '/cliente/pedidos'),
    });
    await sendPushToUser({
      userId: request.client_user_id,
      title,
      body: `O instalador atualizou o pedido #${requestId}.`,
      data: { route: '/cliente/pedidos', requestId },
    }).catch(() => null);
    return res.json({ booking: bookingResult.rows[0], request_status: requestStatus });
  } catch (error) {
    await db?.query('ROLLBACK').catch(() => null);
    db?.release();
    db = null;
    await reportFailure(error, req);
    return res.status(500).json({ error: 'Não foi possível atualizar o serviço.' });
  } finally {
    db?.release();
  }
};
