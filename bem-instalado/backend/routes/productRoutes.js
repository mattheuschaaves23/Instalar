const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/authMiddleware');
const requireAccount = require('../middleware/accountTypeMiddleware');
const verified = require('../middleware/verifiedEmailMiddleware');
const subscription = require('../middleware/subscriptionMiddleware');
const limits = require('../../shared/quoteProducts.json');

const router = express.Router();
router.use(auth, requireAccount('installer'), verified, subscription);

function productId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function parseProduct(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const price = body.price;
  return name && name.length <= limits.maximumNameLength && typeof price === 'number'
    && price > 0 && price <= limits.maximumPrice && Math.round(price * 100) / 100 === price ? [name, price] : null;
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT id, name, price FROM installer_products
      WHERE user_id = $1 AND archived_at IS NULL ORDER BY LOWER(name), id
    `, [req.userId]);
    return res.json(rows);
  } catch (error) { return next(error); }
});

async function saveProduct(req, res, next) {
  const data = parseProduct(req.body);
  const editing = req.params.id !== undefined;
  const id = editing ? productId(req.params.id) : null;
  if (!data || (editing && !id)) {
    return res.status(400).json({ error: 'Informe um nome e um preço válido para o produto.' });
  }
  try {
    const { rows } = editing
      ? await db.query(`
        UPDATE installer_products SET name = $2, price = $3, updated_at = NOW()
        WHERE user_id = $1 AND id = $4 AND archived_at IS NULL RETURNING id, name, price
      `, [req.userId, ...data, id])
      : await db.query(`
        INSERT INTO installer_products (user_id, name, price) VALUES ($1, $2, $3) RETURNING id, name, price
      `, [req.userId, ...data]);
    if (!rows[0]) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.status(editing ? 200 : 201).json(rows[0]);
  } catch (error) { return next(error); }
}
router.post('/', saveProduct);
router.put('/:id', saveProduct);
router.delete('/:id', async (req, res, next) => {
  const id = productId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Produto inválido.' });
  try {
    const result = await db.query(
      'UPDATE installer_products SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND archived_at IS NULL', [id, req.userId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

module.exports = router;
