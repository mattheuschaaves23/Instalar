const { app } = require('../bem-instalado/backend/server');

module.exports = async (req, res) => {
  return app(req, res);
};
