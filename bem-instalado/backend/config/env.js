/**
 * Resolve an environment variable from the canonical name and any legacy
 * aliases that may have been used during the first production setup.
 *
 * Keeping this fallback in one place lets us accept an already-configured
 * deployment without weakening validation or exposing secret values.
 */
function firstEnvValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }

  return '';
}

module.exports = { firstEnvValue };
