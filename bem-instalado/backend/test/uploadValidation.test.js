const test = require('node:test');
const assert = require('node:assert/strict');
const { detectFileMimeType, validateUploadFile } = require('../utils/uploadValidation');

const samples = {
  png: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  jpeg: Buffer.from('ffd8ffe000104a4649460001', 'hex'),
  webp: Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]),
  pdf: Buffer.from('%PDF-1.7\n', 'ascii'),
};

test('detecta os formatos permitidos pela assinatura real do arquivo', () => {
  assert.equal(detectFileMimeType(samples.png), 'image/png');
  assert.equal(detectFileMimeType(samples.jpeg), 'image/jpeg');
  assert.equal(detectFileMimeType(samples.webp), 'image/webp');
  assert.equal(detectFileMimeType(samples.pdf), 'application/pdf');
});

test('rejeita conteúdo diferente do MIME declarado', () => {
  const result = validateUploadFile({ buffer: samples.pdf, mimetype: 'image/png' });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'UPLOAD_TYPE_MISMATCH');
});

test('rejeita PDF quando a rota aceita apenas imagens', () => {
  const result = validateUploadFile(
    { buffer: samples.pdf, mimetype: 'application/pdf' },
    { allowPdf: false }
  );
  assert.equal(result.valid, false);
  assert.equal(result.code, 'PDF_NOT_ALLOWED');
});

test('aceita imagem válida e normaliza image/jpg', () => {
  const result = validateUploadFile({ buffer: samples.jpeg, mimetype: 'image/jpg' });
  assert.deepEqual(result, { valid: true, mimeType: 'image/jpeg' });
});
