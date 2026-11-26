const { APP_TIME_ZONE, sqlLocal } = require('../utils/appTimeZone');

async function getDashboardOverview(db, userId, now = new Date()) {
  const { rows } = await db.query(`
    WITH bounds AS (
      SELECT DATE_TRUNC('month', ${sqlLocal('$2::timestamptz')}) AS current_month
    ), months AS (
      SELECT GENERATE_SERIES(current_month - INTERVAL '22 months', current_month, INTERVAL '1 month') AS month
      FROM bounds
    ), owned_budgets AS (
      SELECT status, total_amount,
        DATE_TRUNC('month', ${sqlLocal("(created_at AT TIME ZONE 'UTC')")}) AS created_month,
        DATE_TRUNC('month', ${sqlLocal("(COALESCE(approved_date, created_at) AT TIME ZONE 'UTC')")}) AS approved_month
      FROM budgets
      WHERE user_id = $1 AND status IN ('approved', 'pending', 'rejected')
    ), proposals AS (
      SELECT created_month AS month,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
      FROM owned_budgets
      GROUP BY created_month
    ), sales AS (
      SELECT approved_month AS month, SUM(total_amount) AS revenue
      FROM owned_budgets
      WHERE status = 'approved'
      GROUP BY approved_month
    ), appointments AS (
      SELECT 'manual-' || s.id AS id, s.date, s.status, c.name AS client_name
      FROM schedules s JOIN clients c ON c.id = s.client_id AND c.user_id = s.user_id
      WHERE s.user_id = $1 AND s.status IN ('scheduled', 'in_progress', 'completed')
      UNION ALL
      SELECT 'marketplace-' || sb.id, sb.scheduled_start, sb.status, sr.client_name
      FROM service_bookings sb JOIN service_requests sr ON sr.id = sb.service_request_id
      WHERE sb.installer_id = $1 AND sb.status IN ('scheduled', 'in_progress', 'completed')
    ), scheduled AS (
      SELECT DATE_TRUNC('month', ${sqlLocal('date')}) AS month, COUNT(*)::int AS installations
      FROM appointments
      GROUP BY 1
    ), upcoming AS (
      SELECT id, date, client_name FROM appointments
      WHERE status <> 'completed' AND date >= $2::timestamptz
      ORDER BY date, id
      LIMIT 2
    ), totals AS (
      SELECT m.month AS sort_key, TO_CHAR(m.month, 'YYYY-MM') AS month,
        COALESCE(s.revenue, 0) AS revenue,
        COALESCE(p.approved, 0) AS approved,
        COALESCE(p.pending, 0) AS pending,
        COALESCE(p.rejected, 0) AS rejected,
        COALESCE(a.installations, 0) AS installations
      FROM months m
      LEFT JOIN sales s USING (month)
      LEFT JOIN proposals p USING (month)
      LEFT JOIN scheduled a USING (month)
    )
    SELECT TO_CHAR(current_month, 'YYYY-MM') AS month,
      (SELECT JSON_AGG(TO_JSONB(t) - 'sort_key' ORDER BY t.sort_key) FROM totals t) AS months,
      (SELECT COALESCE(JSON_AGG(
        JSON_BUILD_OBJECT('id', u.id, 'date', u.date, 'client_name', u.client_name)
        ORDER BY u.date, u.id
      ), '[]'::json) FROM upcoming u) AS upcoming
    FROM bounds
  `, [userId, now.toISOString()]);
  return { ...rows[0], time_zone: APP_TIME_ZONE };
}

module.exports = { getDashboardOverview };
