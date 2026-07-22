async function expireOpenServiceRequests(db = null) {
  const database = db || require('../config/database');
  const result = await database.query(
    `
      UPDATE service_requests
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'open'
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
    `
  );

  return result.rowCount;
}

module.exports = {
  expireOpenServiceRequests,
};
