const multer = require('multer');

const allowedTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error('Formato inválido. Envie PNG, JPG, WEBP ou PDF.');
      error.code = 'INVALID_UPLOAD_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
});

module.exports = upload;
