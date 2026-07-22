const { decodeAssetKey, streamStoredAsset } = require('../services/objectStorage');

const publicKinds = new Set(['logo', 'installer-photo', 'gallery', 'request-photo']);

function getKind(pathname) {
  return String(pathname || '').split('/')[2] || '';
}

exports.getPublicAsset = async (req, res) => {
  const pathname = decodeAssetKey(req.params.assetKey);
  if (!pathname || !publicKinds.has(getKind(pathname))) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  try {
    const found = await streamStoredAsset(pathname, res, { cacheControl: 'public, max-age=86400' });
    if (!found) return res.status(404).json({ error: 'Arquivo não encontrado.' });
    return undefined;
  } catch (_error) {
    return res.status(503).json({ error: 'Arquivo temporariamente indisponível.' });
  }
};
