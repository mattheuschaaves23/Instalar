const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/authMiddleware');
const requireAccount = require('../middleware/accountTypeMiddleware');
const verified = require('../middleware/verifiedEmailMiddleware');
const subscription = require('../middleware/subscriptionMiddleware');
const limits = require('../../shared/quoteProducts.json');
const { parseProductPhoto, encodeProductPhoto } = require('../utils/productPhoto');

const router = express.Router();
router.use(auth, requireAccount('installer'), verified, subscription);
const productFields = 'id, name, price, CASE WHEN photo_jpeg IS NOT NULL THEN updated_at ELSE NULL END AS photo_version';

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
      SELECT ${productFields} FROM installer_products
      WHERE user_id = $1 AND archived_at IS NULL ORDER BY LOWER(name), id
    `, [req.userId]);
    return res.json(rows);
  } catch (error) { return next(error); }
});

router.get('/photos', async (req, res, next) => {
  const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',') : [];
  if (!ids.length || ids.length > limits.catalogPageSize || ids.some((id) => !/^[1-9]\d{0,9}$/.test(id) || !productId(id))) {
    return res.status(400).json({ error: 'Selecione produtos válidos para consultar as fotos.' });
  }
  try {
    const { rows } = await db.query(`
      SELECT id, photo_jpeg FROM installer_products
      WHERE user_id = $1 AND id = ANY($2::int[]) AND archived_at IS NULL AND photo_jpeg IS NOT NULL
    `, [req.userId, ids.map(Number)]);
    return res.set('Cache-Control', 'private, no-store').json(Object.fromEntries(
      rows.map((row) => [row.id, encodeProductPhoto(row.photo_jpeg)])
    ));
  } catch (error) { return next(error); }
});

async function saveProduct(req, res, next) {
  const body = req.body ?? {};
  const data = parseProduct(body);
  const editing = req.params.id !== undefined;
  const id = editing ? productId(req.params.id) : null;
  if (!data || (editing && !id)) {
    return res.status(400).json({ error: 'Informe um nome e um preço válido para o produto.' });
  }
  // Omission keeps the saved photo, so older apps may still edit name and price.
  const photoChanged = Object.hasOwn(body, 'photo');
  const photo = photoChanged ? parseProductPhoto(body.photo) : null;
  if (photoChanged && photo === undefined) {
    return res.status(400).json({ error: 'Não foi possível validar a foto. Escolha outra imagem JPG, PNG ou WebP.' });
  }
  try {
    const { rows } = editing
      ? await db.query(`
        UPDATE installer_products SET name = $2, price = $3, updated_at = NOW(),
          photo_jpeg = CASE WHEN $5::boolean THEN $6::bytea ELSE photo_jpeg END
        WHERE user_id = $1 AND id = $4 AND archived_at IS NULL RETURNING ${productFields}
      `, [req.userId, ...data, id, photoChanged, photo])
      : await db.query(`
        INSERT INTO installer_products (user_id, name, price, photo_jpeg) VALUES ($1, $2, $3, $4) RETURNING ${productFields}
      `, [req.userId, ...data, photo]);
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
