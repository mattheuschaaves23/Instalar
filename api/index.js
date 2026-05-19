const { app, ensureRuntimeSchema } = require('../bem-instalado/backend/server');

let schemaPromise = null;

module.exports = async (req, res) => {
  if (!schemaPromise) {
    schemaPromise = ensureRuntimeSchema();
  }

  await schemaPromise;
  return app(req, res);
};
