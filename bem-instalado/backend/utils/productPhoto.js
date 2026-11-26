const { detectFileMimeType } = require('./uploadValidation');
const limits = require('../../shared/quoteProducts.json');

const prefix = 'data:image/jpeg;base64,';
const dimensionMarkers = new Set([0xc0, 0xc1, 0xc2]);

function thumbnailDimensions(buffer) {
  // Read the JPEG header only; never decode large images on the API server.
  for (let offset = 2; offset + 3 < buffer.length;) {
    if (buffer[offset++] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xda || offset + 2 > buffer.length) return false;
    const size = buffer.readUInt16BE(offset);
    if (size < 2 || offset + size > buffer.length) return false;
    if (dimensionMarkers.has(marker)) {
      if (size < 8 || buffer[offset + 2] !== 8) return false;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return width > 0 && height > 0 && width <= limits.photoEdge && height <= limits.photoEdge;
    }
    offset += size;
  }
  return false;
}

function parseProductPhoto(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !value.startsWith(prefix) ||
      value.length > prefix.length + 4 * Math.ceil(limits.photoBytes / 3)) return undefined;
  const encoded = value.slice(prefix.length);
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 8 || bytes.length > limits.photoBytes || bytes.toString('base64') !== encoded ||
      detectFileMimeType(bytes) !== 'image/jpeg' || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9 ||
      !thumbnailDimensions(bytes)) return undefined;
  return bytes;
}

const encodeProductPhoto = (bytes) => prefix + bytes.toString('base64');

module.exports = { parseProductPhoto, encodeProductPhoto };
