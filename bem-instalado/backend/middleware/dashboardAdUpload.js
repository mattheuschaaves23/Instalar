const multer = require('multer');
const { MAX_AD_MEDIA_BYTES } = require('../utils/dashboardAdMedia');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AD_MEDIA_BYTES, files: 1, fields: 10, fieldSize: 4096 },
}).single('file');

module.exports = (req, res, next) => {
  if (!req.is('multipart/form-data')) return next();
  return upload(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'O arquivo excede 4 MB.' });
    return res.status(400).json({ error: 'Envie somente um arquivo válido para a propaganda.' });
  });
};
