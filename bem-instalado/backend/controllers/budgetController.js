const fs = require('fs/promises');
const pool = require('../config/database');
const { installmentInfo, installmentAmountLabel, installmentConditionsLabel } = require('../../shared/installmentTerms.mjs');
const generateBudgetPDF = require('../utils/generatePDF');
const generateWhatsAppLink = require('../utils/whatsapp');
const {
  getInstallerPlanAccess,
  isLimitReached,
  upgradeRequired,
} = require('../services/planAccess');

const DEFAULT_ROLL_AREA = 4.5;
const MAX_ROLL_AREA = 1000;
const UPFRONT_PAYMENT_METHODS = new Set([
  'pix',
  'boleto',
  'debit_card',
  'credit_card',
  'cash',
  'bank_transfer',
]);
const UPFRONT_PAYMENT_LABELS = {
  pix: 'Pix',
  boleto: 'Boleto',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão à vista',
  cash: 'Dinheiro',
  bank_transfer: 'Transferência',
};

function normalizeNumber(value) {
  return Number(value || 0);
}

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'sim' || normalized === 'yes';
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizePricingMode(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'square_meter' || normalized === 'm2') {
    return 'square_meter';
  }
  return 'roll';
}

function normalizeUpfrontPaymentTerms(value) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('VALIDATION_UPFRONT_PAYMENT_TERMS');
  }

  const methods = new Set();

  return value.map((term) => {
    const method = normalizeString(term?.method).toLowerCase();
    const discountPercent = term?.discount_percent === undefined || term?.discount_percent === null || term?.discount_percent === ''
      ? 0
      : Number(term.discount_percent);

    if (
      !UPFRONT_PAYMENT_METHODS.has(method) ||
      methods.has(method) ||
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      throw new Error('VALIDATION_UPFRONT_PAYMENT_TERMS');
    }

    methods.add(method);
    return {
      method,
      label: UPFRONT_PAYMENT_LABELS[method],
      discount_percent: Math.round(discountPercent * 100) / 100,
    };
  });
}

function formatUpfrontPaymentTerms(value) {
  try {
    return normalizeUpfrontPaymentTerms(value)
      .map((term) => `${term.label}${term.discount_percent > 0 ? ` (${term.discount_percent}% de desconto)` : ''}`)
      .join(', ');
  } catch (_error) {
    return '';
  }
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

function buildServiceLocation(client) {
  const street = normalizeString(client?.street);
  const number = normalizeString(client?.house_number);
  const neighborhood = normalizeString(client?.neighborhood);
  const city = normalizeString(client?.city);
  const state = normalizeString(client?.state);
  const zipCode = normalizeString(client?.zip_code);
  const reference = firstFilled(client?.address_reference, client?.address);

  const line1 = [street, number && `Nº ${number}`].filter(Boolean).join(', ');
  const line2 = [neighborhood, [city, state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  const baseAddress = [line1, line2, zipCode && `CEP ${zipCode}`].filter(Boolean).join(' • ');
  const fullAddress = firstFilled(baseAddress, client?.address, 'Endereço não informado');

  return {
    street: street || null,
    number: number || null,
    neighborhood: neighborhood || null,
    city: city || null,
    state: state || null,
    zipCode: zipCode || null,
    reference: reference || null,
    fullAddress,
  };
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function parseScheduleDateTime(value) {
  const raw = normalizeString(value).replace(' ', 'T');
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/);
  if (!match) {
    return null;
  }

  const datePart = match[1];
  const timePart = `${match[2]}${match[3] || ':00'}`;
  const parsed = new Date(`${datePart}T${timePart}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    parsed,
    dbTimestamp: `${datePart} ${timePart}`,
  };
}

exports.createBudget = async (req, res) => {
  let db;
  let transactionStarted = false;

  try {
    db = await pool.connect();
    const {
      client_id,
      environments,
      pricing_mode,
      roll_area,
      price_per_roll,
      price_per_square_meter,
      installment_enabled,
      installments_count,
      interest_free_installments,
      installment_interest_rate,
      upfront_payment_terms,
      removal_included,
      removal_price,
      removal_price_per_roll,
    } = req.body;
    const cleanClientId = Number(client_id);
    const cleanPricingMode = normalizePricingMode(pricing_mode);
    const cleanRollArea = roll_area === null || roll_area === undefined || String(roll_area).trim() === ''
      ? DEFAULT_ROLL_AREA
      : Number(roll_area);
    const cleanPricePerRoll = normalizeNumber(price_per_roll);
    const cleanPricePerSquareMeter = normalizeNumber(price_per_square_meter);
    const installmentsEnabled = normalizeBoolean(installment_enabled);
    const requestedInstallmentsCount = normalizeInteger(installments_count);
    const installmentsCount = installmentsEnabled ? requestedInstallmentsCount : 1;
    const requestedInterestFreeInstallments = interest_free_installments === undefined || interest_free_installments === null || interest_free_installments === ''
      ? requestedInstallmentsCount
      : normalizeInteger(interest_free_installments);
    const requestedInstallmentInterestRate = installment_interest_rate === undefined || installment_interest_rate === null || installment_interest_rate === ''
      ? 0
      : Number(installment_interest_rate);
    const interestFreeInstallments = installmentsEnabled ? requestedInterestFreeInstallments : 1;
    const installmentInterestRate = installmentsEnabled ? requestedInstallmentInterestRate : 0;
    const upfrontPaymentTerms = normalizeUpfrontPaymentTerms(upfront_payment_terms);
    const usesRemovalPerRoll = Object.prototype.hasOwnProperty.call(req.body || {}, 'removal_price_per_roll');
    const removalIncludedByRoll = normalizeBoolean(removal_included);
    const removalPricePerRoll = removal_price_per_roll === null || removal_price_per_roll === undefined || String(removal_price_per_roll).trim() === ''
      ? 0
      : Number(removal_price_per_roll);
    const legacyRemovalIncluded = normalizeBoolean(removal_included);
    const legacyRemovalPrice = removal_price === null || removal_price === undefined || String(removal_price).trim() === ''
      ? 0
      : Number(removal_price);

    if (!Number.isInteger(cleanClientId) || cleanClientId <= 0) {
      return res.status(400).json({ error: 'Cliente inválido.' });
    }

    if (!Array.isArray(environments) || environments.length === 0) {
      return res.status(400).json({ error: 'Cliente e ambientes são obrigatórios.' });
    }

    const planAccess = req.planAccess || await getInstallerPlanAccess(req.userId, db);

    if (isLimitReached(planAccess, 'monthly_budgets')) {
      return upgradeRequired(res, {
        code: 'FREE_BUDGET_LIMIT',
        error: `O plano Grátis permite ${planAccess.limits.monthly_budgets} novos orçamentos por mês. Seus orçamentos atuais continuam disponíveis.`,
        planAccess,
        feature: 'unlimited_budgets',
      });
    }

    const environmentLimit = planAccess.limits.environments_per_budget;
    if (environmentLimit !== null && environments.length > environmentLimit) {
      return upgradeRequired(res, {
        code: 'PRO_MULTI_ENVIRONMENT_REQUIRED',
        error: 'Orçamentos com vários ambientes estão disponíveis no plano Pro.',
        planAccess,
        feature: 'multi_environment_budgets',
      });
    }

    if (cleanPricingMode === 'roll' && !isPositiveNumber(cleanPricePerRoll)) {
      return res.status(400).json({ error: 'Preço por rolo deve ser maior que zero.' });
    }

    if (cleanPricingMode === 'square_meter' && !isPositiveNumber(cleanPricePerSquareMeter)) {
      return res.status(400).json({ error: 'Preço por metro quadrado deve ser maior que zero.' });
    }

    if (!isPositiveNumber(cleanRollArea) || cleanRollArea > MAX_ROLL_AREA) {
      return res.status(400).json({ error: 'Rendimento do rolo precisa ser maior que zero e menor que 1000 m².' });
    }

    if (
      usesRemovalPerRoll &&
      removalIncludedByRoll &&
      (!Number.isFinite(removalPricePerRoll) || removalPricePerRoll < 0)
    ) {
      return res.status(400).json({ error: 'Remoção por rolo precisa ser um valor válido e não negativo.' });
    }

    if (
      !usesRemovalPerRoll &&
      legacyRemovalIncluded &&
      (!Number.isFinite(legacyRemovalPrice) || legacyRemovalPrice < 0)
    ) {
      return res.status(400).json({ error: 'Preço de remoção legado inválido.' });
    }

    if (installmentsEnabled) {
      if (!Number.isInteger(installmentsCount) || installmentsCount < 2 || installmentsCount > 12) {
        return res.status(400).json({ error: 'Parcelamento deve ser entre 2x e 12x.' });
      }

      if (!Number.isInteger(interestFreeInstallments) || interestFreeInstallments < 1 || interestFreeInstallments > installmentsCount) {
        return res.status(400).json({ error: 'Parcelas sem juros devem ficar entre 1x e o máximo do cartão.' });
      }

      if (!Number.isFinite(installmentInterestRate) || installmentInterestRate < 0 || installmentInterestRate > 100) {
        return res.status(400).json({ error: 'Juros do parcelamento devem ficar entre 0% e 100%.' });
      }
    }

    const clientCheck = await db.query('SELECT id FROM clients WHERE id = $1 AND user_id = $2', [cleanClientId, req.userId]);

    if (!clientCheck.rowCount) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    let totalArea = 0;
    let totalRolls = 0;
    let subtotal = 0;
    let totalRemovalByEnvironment = 0;
    let totalRemovalRolls = 0;

    const computedEnvironments = environments.map((environment) => {
      const name = normalizeString(environment.name);
      const height = normalizeNumber(environment.height);
      const width = normalizeNumber(environment.width);
      const hasManualRolls = environment.rolls_manual !== null && environment.rolls_manual !== undefined && String(environment.rolls_manual).trim() !== '';
      const rollsManual = hasManualRolls ? Number(environment.rolls_manual) : null;
      const removalIncludedByEnvironment = normalizeBoolean(environment.removal_included);
      const removalPriceByEnvironmentRaw =
        environment.removal_price === null ||
        environment.removal_price === undefined ||
        String(environment.removal_price).trim() === ''
          ? 0
          : Number(environment.removal_price);

      if (!name) {
        throw new Error('VALIDATION_ENV_NAME');
      }

      if (!isPositiveNumber(height) || !isPositiveNumber(width)) {
        throw new Error('VALIDATION_ENV_SIZE');
      }

      if (hasManualRolls && (!Number.isInteger(rollsManual) || rollsManual <= 0)) {
        throw new Error('VALIDATION_ENV_ROLLS');
      }

      if (
        usesRemovalPerRoll &&
        removalIncludedByEnvironment &&
        (!Number.isFinite(removalPricePerRoll) || removalPricePerRoll < 0)
      ) {
        throw new Error('VALIDATION_REMOVAL_PER_ROLL');
      }

      if (
        !usesRemovalPerRoll &&
        removalIncludedByEnvironment &&
        (!Number.isFinite(removalPriceByEnvironmentRaw) || removalPriceByEnvironmentRaw < 0)
      ) {
        throw new Error('VALIDATION_ENV_REMOVAL');
      }

      const area = height * width;
      const rollsAuto = Math.ceil(area / cleanRollArea);
      const rollsUsed = rollsManual || rollsAuto;
      const subtotalByEnvironment = cleanPricingMode === 'square_meter'
        ? area * cleanPricePerSquareMeter
        : rollsUsed * cleanPricePerRoll;
      const removalPriceByEnvironment = removalIncludedByEnvironment
        ? (usesRemovalPerRoll ? removalPricePerRoll : removalPriceByEnvironmentRaw)
        : 0;
      const removalTotalByEnvironment = removalIncludedByEnvironment
        ? (usesRemovalPerRoll ? rollsUsed * removalPriceByEnvironment : removalPriceByEnvironment)
        : 0;
      const total = subtotalByEnvironment + removalTotalByEnvironment;

      totalArea += area;
      totalRolls += rollsUsed;
      subtotal += subtotalByEnvironment;
      totalRemovalByEnvironment += removalTotalByEnvironment;
      totalRemovalRolls += usesRemovalPerRoll && removalIncludedByEnvironment ? rollsUsed : 0;

      return {
        name,
        height,
        width,
        area,
        rollsAuto,
        rollsManual,
        pricePerSquareMeter: cleanPricingMode === 'square_meter' ? cleanPricePerSquareMeter : 0,
        pricePerRoll: cleanPricingMode === 'roll' ? cleanPricePerRoll : 0,
        removalIncluded: removalIncludedByEnvironment,
        removalPrice: removalPriceByEnvironment,
        removalTotal: removalTotalByEnvironment,
        total,
      };
    });

    const hasEnvironmentRemoval = !usesRemovalPerRoll && computedEnvironments.some((environment) => environment.removalIncluded);
    const fallbackLegacyRemoval = !usesRemovalPerRoll && legacyRemovalIncluded ? legacyRemovalPrice : 0;

    if (!hasEnvironmentRemoval && fallbackLegacyRemoval > 0 && computedEnvironments.length > 0) {
      computedEnvironments[0].removalIncluded = true;
      computedEnvironments[0].removalPrice = fallbackLegacyRemoval;
      computedEnvironments[0].removalTotal = fallbackLegacyRemoval;
      computedEnvironments[0].total += fallbackLegacyRemoval;
      totalRemovalByEnvironment = fallbackLegacyRemoval;
    }

    const removalCost = totalRemovalByEnvironment;
    const totalAmount = subtotal + removalCost;

    await db.query('BEGIN');
    transactionStarted = true;

    const budgetResult = await db.query(
      `
        INSERT INTO budgets (
          user_id,
          client_id,
          status,
          pricing_mode,
          roll_area,
          price_per_roll,
          price_per_square_meter,
          total_rolls,
          total_area,
          subtotal_rolls,
          removal_cost,
          removal_included,
          removal_price_per_roll,
          removal_rolls,
          total_amount,
          installment_enabled,
          installments_count,
          interest_free_installments,
          installment_interest_rate,
          payment_terms
        )
        VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `,
      [
        req.userId,
        cleanClientId,
        cleanPricingMode,
        cleanRollArea,
        cleanPricingMode === 'roll' ? cleanPricePerRoll : 0,
        cleanPricingMode === 'square_meter' ? cleanPricePerSquareMeter : 0,
        totalRolls,
        totalArea,
        subtotal,
        removalCost,
        usesRemovalPerRoll && totalRemovalRolls > 0,
        usesRemovalPerRoll && totalRemovalRolls > 0 ? removalPricePerRoll : 0,
        usesRemovalPerRoll ? totalRemovalRolls : 0,
        totalAmount,
        installmentsEnabled,
        installmentsEnabled ? installmentsCount : 1,
        installmentsEnabled ? interestFreeInstallments : 1,
        installmentsEnabled ? Math.round(installmentInterestRate * 100) / 100 : 0,
        JSON.stringify(upfrontPaymentTerms),
      ]
    );

    const budget = budgetResult.rows[0];

    for (const environment of computedEnvironments) {
      await db.query(
        `
          INSERT INTO environments (
            budget_id,
            name,
            height,
            width,
            area,
            rolls_auto,
            rolls_manual,
            price_per_square_meter,
            removal_included,
            removal_price,
            removal_total,
            price_per_roll,
            total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          budget.id,
          environment.name,
          environment.height,
          environment.width,
          environment.area,
          environment.rollsAuto,
          environment.rollsManual,
          environment.pricePerSquareMeter,
          environment.removalIncluded,
          environment.removalPrice,
          environment.removalTotal,
          environment.pricePerRoll,
          environment.total,
        ]
      );
    }

    await db.query('COMMIT');
    transactionStarted = false;
    return res.status(201).json(budget);
  } catch (error) {
    if (transactionStarted) {
      await db.query('ROLLBACK');
    }

    if (error?.message === 'VALIDATION_ENV_NAME') {
      return res.status(400).json({ error: 'Cada ambiente precisa ter um nome.' });
    }

    if (error?.message === 'VALIDATION_ENV_SIZE') {
      return res.status(400).json({ error: 'Altura e largura devem ser maiores que zero.' });
    }

    if (error?.message === 'VALIDATION_ENV_ROLLS') {
      return res.status(400).json({ error: 'Rolos manuais devem ser um número inteiro positivo.' });
    }

    if (error?.message === 'VALIDATION_ENV_REMOVAL') {
      return res.status(400).json({ error: 'Remoção por ambiente precisa ser um valor válido e não negativo.' });
    }

    if (error?.message === 'VALIDATION_REMOVAL_PER_ROLL') {
      return res.status(400).json({ error: 'Remoção por rolo precisa ser um valor válido e não negativo.' });
    }

    if (error?.message === 'VALIDATION_UPFRONT_PAYMENT_TERMS') {
      return res.status(400).json({ error: 'Revise as formas de pagamento à vista e seus descontos.' });
    }

    return res.status(500).json({ error: 'Erro ao criar orçamento.' });
  } finally {
    db?.release();
  }
};

exports.getBudgets = async (req, res) => {
  try {
    if (req.query.summary === 'true') {
      const { rows } = await pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE status = 'approved')::int AS total_approved,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS total_pending,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) AS total_revenue
          FROM budgets
          WHERE user_id = $1
        `,
        [req.userId]
      );

      return res.json(rows[0]);
    }

    const { rows } = await pool.query(
      `
        SELECT b.*, c.name AS client_name
        FROM budgets b
        JOIN clients c ON c.id = b.client_id
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC
      `,
      [req.userId]
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao listar orçamentos.' });
  }
};

exports.getBudget = async (req, res) => {
  try {
    const budgetResult = await pool.query(
      `
        SELECT b.*, c.name AS client_name, c.phone, c.email, c.address
        FROM budgets b
        JOIN clients c ON c.id = b.client_id
        WHERE b.id = $1 AND b.user_id = $2
      `,
      [req.params.id, req.userId]
    );

    const budget = budgetResult.rows[0];

    if (!budget) {
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    const environmentsResult = await pool.query(
      `
        SELECT *
        FROM environments
        WHERE budget_id = $1
        ORDER BY id ASC
      `,
      [req.params.id]
    );

    return res.json({ ...budget, environments: environmentsResult.rows });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao buscar orçamento.' });
  }
};

exports.approveBudget = async (req, res) => {
  let db;
  let transactionStarted = false;

  try {
    db = await pool.connect();
    const { schedule_date } = req.body;
    const parsedScheduleDate = schedule_date ? parseScheduleDateTime(schedule_date) : null;

    if (schedule_date && !parsedScheduleDate) {
      return res.status(400).json({ error: 'Data de agendamento inválida.' });
    }

    await db.query('BEGIN');
    transactionStarted = true;

    // Always acquire locks in this order, including repeated approval requests.
    await db.query('SELECT pg_advisory_xact_lock($1)', [req.userId]);
    const existingResult = await db.query('SELECT * FROM budgets WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, req.userId]);
    const existing = existingResult.rows[0];
    if (!existing) {
      await db.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }
    if (existing.status === 'approved') {
      const existingDate = existing.schedule_date instanceof Date
        ? existing.schedule_date
        : parseScheduleDateTime(existing.schedule_date)?.parsed;
      if (parsedScheduleDate && existingDate?.getTime() !== parsedScheduleDate.parsed.getTime()) {
        await db.query('ROLLBACK');
        transactionStarted = false;
        return res.status(409).json({ code: 'BUDGET_ALREADY_APPROVED', error: 'Esse orçamento já foi aprovado. Não é possível mudar o horário repetindo a aprovação.' });
      }
      const schedules = await db.query('SELECT * FROM schedules WHERE budget_id = $1 AND user_id = $2 LIMIT 1', [existing.id, req.userId]);
      await db.query('COMMIT');
      transactionStarted = false;
      return res.json({ budget: existing, schedule: schedules.rows[0] || null });
    }
    if (existing.status !== 'pending') {
      await db.query('ROLLBACK');
      transactionStarted = false;
      return res.status(409).json({ code: 'BUDGET_STATUS_CONFLICT', error: 'Somente orçamentos pendentes podem ser aprovados.' });
    }

    const budgetResult = await db.query(
      `
        UPDATE budgets
        SET status = 'approved', schedule_date = COALESCE($1, schedule_date), approved_date = NOW(), updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `,
      [parsedScheduleDate ? parsedScheduleDate.dbTimestamp : null, req.params.id, req.userId]
    );

    const budget = budgetResult.rows[0];

    if (!budget) {
      await db.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    let schedule = null;

    if (parsedScheduleDate) {
      const clientResult = await db.query(
        `
          SELECT
            name,
            address,
            street,
            house_number,
            neighborhood,
            city,
            state,
            zip_code,
            address_reference
          FROM clients
          WHERE id = $1 AND user_id = $2
        `,
        [budget.client_id, req.userId]
      );
      const client = clientResult.rows[0];
      const location = buildServiceLocation(client);
      const existingScheduleResult = await db.query(
        `
          SELECT id
          FROM schedules
          WHERE budget_id = $1 AND user_id = $2
          LIMIT 1
        `,
        [budget.id, req.userId]
      );

      const existingScheduleId = existingScheduleResult.rows[0]?.id || null;
      const conflict = await db.query(
        `SELECT id
         FROM schedules
         WHERE user_id = $1
           AND status = 'scheduled'
           AND date = $2
           AND ($3::int IS NULL OR id <> $3)
         UNION ALL
         SELECT id
         FROM service_bookings
         WHERE installer_id = $1
           AND status IN ('scheduled', 'in_progress')
           AND scheduled_start <= $2
           AND scheduled_end > $2
         LIMIT 1`,
        [req.userId, parsedScheduleDate.dbTimestamp, existingScheduleId]
      );

      if (conflict.rowCount) {
        await db.query('ROLLBACK');
        transactionStarted = false;
        return res.status(409).json({
          error: 'Esse horário já está ocupado na agenda. Escolha outro horário para aprovar o orçamento.',
          code: 'SCHEDULE_TIME_CONFLICT',
        });
      }

      if (existingScheduleResult.rows[0]) {
        const scheduleResult = await db.query(
          `
            UPDATE schedules
            SET
              title = $1,
              description = $2,
              date = $3,
              status = 'scheduled',
              service_street = $4,
              service_number = $5,
              service_neighborhood = $6,
              service_city = $7,
              service_state = $8,
              service_zip_code = $9,
              service_reference = $10,
              service_full_address = $11,
              updated_at = NOW()
            WHERE id = $12
            RETURNING *
          `,
          [
              `Instalação - ${client ? client.name : 'Cliente'}`,
              `Orçamento #${budget.id} aprovado. Endereço: ${location.fullAddress}.`,
              parsedScheduleDate.dbTimestamp,
            location.street,
            location.number,
            location.neighborhood,
            location.city,
            location.state,
            location.zipCode,
            location.reference,
            location.fullAddress,
            existingScheduleResult.rows[0].id,
          ]
        );

        schedule = scheduleResult.rows[0];
      } else {
        const scheduleResult = await db.query(
          `
            INSERT INTO schedules (
              user_id,
              budget_id,
              client_id,
              title,
              description,
              date,
              status,
              service_street,
              service_number,
              service_neighborhood,
              service_city,
              service_state,
              service_zip_code,
              service_reference,
              service_full_address
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
          `,
          [
            req.userId,
            budget.id,
            budget.client_id,
              `Instalação - ${client ? client.name : 'Cliente'}`,
              `Orçamento #${budget.id} aprovado. Endereço: ${location.fullAddress}.`,
              parsedScheduleDate.dbTimestamp,
            location.street,
            location.number,
            location.neighborhood,
            location.city,
            location.state,
            location.zipCode,
            location.reference,
            location.fullAddress,
          ]
        );

        schedule = scheduleResult.rows[0];
      }
    }

    await db.query(
      `
        INSERT INTO notifications (user_id, title, message, type, read)
        VALUES ($1, $2, $3, 'success', false)
      `,
      [req.userId, 'Orçamento aprovado', `O orçamento #${budget.id} foi aprovado.`]
    );

    await db.query('COMMIT');
    transactionStarted = false;
    return res.json({ budget, schedule });
  } catch (_error) {
    if (transactionStarted) {
      await db.query('ROLLBACK');
    }
    return res.status(500).json({ error: 'Erro ao aprovar orçamento.' });
  } finally {
    db?.release();
  }
};

exports.rejectBudget = async (req, res) => {
  let db;
  let transactionStarted = false;
  try {
    db = await pool.connect();
    await db.query('BEGIN');
    transactionStarted = true;
    await db.query('SELECT pg_advisory_xact_lock($1)', [req.userId]);
    const existingResult = await db.query('SELECT * FROM budgets WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, req.userId]);
    const existing = existingResult.rows[0];
    if (!existing) {
      await db.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }
    if (existing.status === 'rejected') {
      await db.query('COMMIT');
      transactionStarted = false;
      return res.json(existing);
    }
    if (existing.status !== 'pending') {
      await db.query('ROLLBACK');
      transactionStarted = false;
      return res.status(409).json({ code: 'BUDGET_STATUS_CONFLICT', error: 'Somente orçamentos pendentes podem ser rejeitados. Para cancelar uma instalação aprovada, use a agenda.' });
    }
    const { rows } = await db.query(
      `
        UPDATE budgets
        SET status = 'rejected', updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `,
      [req.params.id, req.userId]
    );

    if (!rows[0]) {
      await db.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    await db.query('COMMIT');
    transactionStarted = false;
    return res.json(rows[0]);
  } catch (_error) {
    if (transactionStarted) await db.query('ROLLBACK');
    return res.status(500).json({ error: 'Erro ao rejeitar orçamento.' });
  } finally {
    db?.release();
  }
};

exports.generatePDF = async (req, res) => {
  try {
    const planAccess = req.planAccess || await getInstallerPlanAccess(req.userId);
    const budgetResult = await pool.query(`SELECT * FROM budgets WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId]);
    const budget = budgetResult.rows[0];

    if (!budget) {
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    const clientResult = await pool.query(`SELECT * FROM clients WHERE id = $1 AND user_id = $2`, [budget.client_id, req.userId]);
    const userResult = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          phone,
          logo,
          installer_photo,
          business_name,
          COALESCE(pdf_branding, '{}'::jsonb) AS pdf_branding
        FROM users
        WHERE id = $1
      `,
      [req.userId]
    );
    const environmentsResult = await pool.query(`SELECT * FROM environments WHERE budget_id = $1 ORDER BY id`, [budget.id]);

    const filePath = await generateBudgetPDF({
      budget,
      client: clientResult.rows[0],
      environments: environmentsResult.rows,
      user: userResult.rows[0],
      isPro: planAccess.is_pro,
      branding: planAccess.features.custom_pdf_branding ? userResult.rows[0]?.pdf_branding : null,
    });

    return res.download(filePath, `orcamento-${budget.id}.pdf`, async () => {
      await fs.unlink(filePath).catch(() => null);
    });
  } catch (error) {
    console.error('Falha ao gerar PDF do orçamento.', {
      budgetId: req.params.id,
      userId: req.userId,
      message: error?.message,
    });
    return res.status(500).json({ error: 'Erro ao gerar PDF.' });
  }
};

exports.sendWhatsApp = async (req, res) => {
  try {
    const budgetResult = await pool.query(
      `
        SELECT b.*, c.name AS client_name, c.phone
        FROM budgets b
        JOIN clients c ON c.id = b.client_id
        WHERE b.id = $1 AND b.user_id = $2
      `,
      [req.params.id, req.userId]
    );

    const budget = budgetResult.rows[0];

    if (!budget) {
      return res.status(404).json({ error: 'Orçamento não encontrado.' });
    }

    const installment = installmentInfo(budget);
    const installmentText = installment.enabled
      ? ` Parcelamento disponível: até ${installmentAmountLabel(installment)}. ${installmentConditionsLabel(installment)}`
      : '';
    const upfrontPaymentTerms = formatUpfrontPaymentTerms(budget.payment_terms);
    const upfrontPaymentText = upfrontPaymentTerms
      ? ` À vista: ${upfrontPaymentTerms}.`
      : '';

    const link = generateWhatsAppLink(
      budget.phone,
      `Olá ${budget.client_name}, seu orçamento #${budget.id} ficou em R$ ${Number(budget.total_amount || 0).toFixed(2)}.${installmentText}${upfrontPaymentText}`
    );

    return res.json({ link });
  } catch (_error) {
    return res.status(500).json({ error: 'Erro ao gerar link do WhatsApp.' });
  }
};
