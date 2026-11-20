function clientFacingRequestStatus(row) {
  if (row.status !== 'direct_pending') return row.status;
  return row.expires_at && new Date(row.expires_at) <= new Date() ? 'expired' : 'open';
}

async function expireOpenServiceRequests(db = null) {
  const database = db || require('../config/database');
  const result = await database.query(
    `
      UPDATE service_requests
      SET status = 'expired', updated_at = NOW()
      WHERE (status = 'open' OR status = 'direct_pending')
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
    `
  );

  return result.rowCount;
}

module.exports = {
  clientFacingRequestStatus,
  expireOpenServiceRequests,
};
