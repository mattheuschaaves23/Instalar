const FILE_SIGNATURES = [
  {
    mimeType: 'image/png',
    matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  },
  {
    mimeType: 'image/jpeg',
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/webp',
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mimeType: 'application/pdf',
    matches: (buffer) => buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  },
];

function normalizeMimeType(value) {
  const mimeType = String(value || '').trim().toLowerCase();
  return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
}

function detectFileMimeType(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return '';
  }

  return FILE_SIGNATURES.find((signature) => signature.matches(buffer))?.mimeType || '';
}

function validateUploadFile(file, { allowPdf = true } = {}) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    return { valid: false, code: 'EMPTY_UPLOAD', error: 'O arquivo enviado está vazio.' };
  }

  const declaredMimeType = normalizeMimeType(file.mimetype);
  const detectedMimeType = detectFileMimeType(file.buffer);

  if (!detectedMimeType) {
    return {
      valid: false,
      code: 'INVALID_UPLOAD_CONTENT',
      error: 'O conteúdo do arquivo não corresponde a PNG, JPG, WEBP ou PDF válido.',
    };
  }

  if (detectedMimeType !== declaredMimeType) {
    return {
      valid: false,
      code: 'UPLOAD_TYPE_MISMATCH',
      error: 'O tipo informado não corresponde ao conteúdo real do arquivo.',
    };
  }

  if (!allowPdf && detectedMimeType === 'application/pdf') {
    return {
      valid: false,
      code: 'PDF_NOT_ALLOWED',
      error: 'PDF é permitido somente para certificados.',
    };
  }

  return { valid: true, mimeType: detectedMimeType };
}

module.exports = {
  detectFileMimeType,
  normalizeMimeType,
  validateUploadFile,
};
