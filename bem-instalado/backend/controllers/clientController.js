const pool = require('../config/database');
const { normalizeDocument, isValidDocument: hasValidDocument } = require('../../shared/documents.mjs');
const {
  getInstallerPlanAccess,
  isLimitReached,
  upgradeRequired,
} = require('../services/planAccess');

function normalizeNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeClientType(value) {
  return String(value || '').trim().toLowerCase() === 'company' ? 'company' : 'person';
}

exports.createClient = async (req, res) => {
  try {
    const {
      name,
      phone,
      client_type,
      document_id,
      whatsapp,
      contact_name,
      email,
      address,
      street,
      house_number,
      neighborhood,
      city,
      state,
      zip_code,
      address_reference,
    } = req.body;

    const clientType = normalizeClientType(client_type);
    const document = normalizeDocument(document_id);

    if (!hasValidDocument(document, clientType)) {
      return res.status(400).json({ error: `Informe um ${clientType === 'company' ? 'CNPJ' : 'CPF'} válido.` });
    }

    if (clientType === 'company' && !normalizeNullableString(contact_name)) {
      return res.status(400).json({ error: 'Informe a pessoa responsável pela empresa.' });
    }

    if (!normalizeNullableString(name) || !normalizeNullableString(phone)) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }

    const planAccess = req.planAccess || await getInstallerPlanAccess(req.userId);
    if (isLimitReached(planAccess, 'clients')) {
      return upgradeRequired(res, {
        code: 'FREE_CLIENT_LIMIT',
        error: `O plano Grátis permite até ${planAccess.limits.clients} clientes. Você pode editar ou excluir os atuais, ou assinar o Pro para cadastrar sem limite.`,
        planAccess,
        feature: 'unlimited_clients',
      });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO clients (
          user_id,
          name,
          phone,
          client_type,
          document_id,
          whatsapp,
          contact_name,
          email,
          address,
          street,
          house_number,
          neighborhood,
          city,
          state,
          zip_code,
          address_reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `,
      [
        req.userId,
        String(name).trim(),
        String(phone).trim(),
        clientType,
        document,
        normalizeNullableString(whatsapp) || String(phone).trim(),
        clientType === 'company' ? normalizeNullableString(contact_name) : null,
        normalizeNullableString(email),
        normalizeNullableString(address),
        normalizeNullableString(street),
        normalizeNullableString(house_number),
        normalizeNullableString(neighborhood),
        normalizeNullableString(city),
        normalizeNullableString(state),
        normalizeNullableString(zip_code),
        normalizeNullableString(address_reference),
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao criar cliente.' });
  }
};

exports.getClients = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM clients
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.userId]
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
};

exports.getClient = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM clients
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar cliente.' });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const {
      name,
      phone,
      client_type,
      document_id,
      whatsapp,
      contact_name,
      email,
      address,
      street,
      house_number,
      neighborhood,
      city,
      state,
      zip_code,
      address_reference,
    } = req.body;

    const clientType = client_type === undefined ? null : normalizeClientType(client_type);
    const document = document_id === undefined ? null : normalizeDocument(document_id);
    const existingResult = await pool.query('SELECT * FROM clients WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Cliente não encontrado.' });

    const effectiveType = clientType || normalizeClientType(existing.client_type);
    // Preserve legacy documents when editing unrelated fields, but validate every document/type change.
    if ((document_id !== undefined || client_type !== undefined)
      && !hasValidDocument(document_id === undefined ? existing.document_id : document, effectiveType)) {
      return res.status(400).json({ error: `Informe um ${effectiveType === 'company' ? 'CNPJ' : 'CPF'} válido.` });
    }
    if ((name !== undefined && !normalizeNullableString(name)) || (phone !== undefined && !normalizeNullableString(phone))) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }
    if (effectiveType === 'company' && (client_type !== undefined || contact_name !== undefined)
      && !normalizeNullableString(contact_name === undefined ? existing.contact_name : contact_name)) {
      return res.status(400).json({ error: 'Informe a pessoa responsável pela empresa.' });
    }

    const { rows } = await pool.query(
      `
        UPDATE clients
        SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          client_type = COALESCE($3, client_type),
          document_id = COALESCE($4, document_id),
          whatsapp = COALESCE($5, whatsapp),
          contact_name = COALESCE($6, contact_name),
          email = COALESCE($7, email),
          address = COALESCE($8, address),
          street = COALESCE($9, street),
          house_number = COALESCE($10, house_number),
          neighborhood = COALESCE($11, neighborhood),
          city = COALESCE($12, city),
          state = COALESCE($13, state),
          zip_code = COALESCE($14, zip_code),
          address_reference = COALESCE($15, address_reference),
          updated_at = NOW()
        WHERE id = $16 AND user_id = $17
        RETURNING *
      `,
      [
        normalizeNullableString(name),
        normalizeNullableString(phone),
        clientType,
        document,
        normalizeNullableString(whatsapp),
        normalizeNullableString(contact_name),
        normalizeNullableString(email),
        normalizeNullableString(address),
        normalizeNullableString(street),
        normalizeNullableString(house_number),
        normalizeNullableString(neighborhood),
        normalizeNullableString(city),
        normalizeNullableString(state),
        normalizeNullableString(zip_code),
        normalizeNullableString(address_reference),
        req.params.id,
        req.userId,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    return res.json(rows[0]);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `
        DELETE FROM clients
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.userId]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    return res.json({ success: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
};
