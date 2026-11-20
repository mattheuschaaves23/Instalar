const { normalizeSearchText } = require('../utils/textSearch');

const fold = (expression) => `TRANSLATE(LOWER(COALESCE(${expression}, '')), 'áàâãäçéèêëíìîïñóòôõöúùûüýÿ', 'aaaaaceeeeiiiinooooouuuuyy')`;
const text = (value, length = 120) => String(value || '').trim().slice(0, length);
const integer = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== '' && value !== undefined
  ? Math.min(max, Math.max(min, Math.trunc(Number(value)))) : fallback;
const parseOpportunityId = (value) => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647
  ? Number(value) : null;

function normalizeListingOptions(query = {}) {
  return {
    status: ['interested', 'selected', 'all'].includes(query.status) ? query.status : 'open',
    limit: integer(query.limit, 60, 1, 100),
    offset: integer(query.offset, 0, 0, 50000),
    search: normalizeSearchText(text(query.q)),
    city: normalizeSearchText(text(query.city)),
    state: normalizeSearchText(text(query.state, 2)),
    place: ['residential', 'commercial', 'other'].includes(query.place) ? query.place : '',
    photos: query.photos === 'true',
    sort: ['nearest', 'oldest'].includes(query.sort) ? query.sort : 'newest',
  };
}

async function getOpportunityListing(db, installer, userId, query) {
  const options = normalizeListingOptions(query);
  const coordinates = [installer.latitude, installer.longitude];
  const hasCoordinates = coordinates.every((value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
  const values = [
    userId, normalizeSearchText(installer.city), normalizeSearchText(installer.state),
    hasCoordinates ? Number(installer.latitude) : null, hasCoordinates ? Number(installer.longitude) : null,
    integer(installer.service_radius_km, 80, 10, 250), options.status, options.limit, options.offset,
    options.search, options.city, options.state, options.place, options.photos, options.sort, parseOpportunityId(query?.request_id),
  ];

  // Count before filtering/pagination. Historical relationships belong to the
  // installer, not to their current city; new requests still respect the region.
  const result = await db.query(`
    WITH candidates AS (
      SELECT sr.*, sri.id AS my_interest_id, sri.status AS my_interest_status,
        sri.created_at AS my_interest_at,
        COALESCE(sr.selected_installer_id = $1, FALSE) AS selected_by_me,
        sri.id IS NOT NULL AS interested_by_me,
        CASE WHEN $4::double precision IS NOT NULL AND sr.latitude IS NOT NULL AND sr.longitude IS NOT NULL
          THEN 6371 * 2 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
            POWER(SIN(RADIANS(sr.latitude::double precision - $4) / 2), 2)
            + COS(RADIANS($4)) * COS(RADIANS(sr.latitude::double precision))
            * POWER(SIN(RADIANS(sr.longitude::double precision - $5::double precision) / 2), 2)
          )))) ELSE NULL END AS distance_km,
        ${fold('sr.city')} = NULLIF($2, '') AND ${fold('sr.state')} = NULLIF($3, '') AS same_city,
        ${fold('sr.state')} = NULLIF($3, '') AS same_state
      FROM service_requests sr
      LEFT JOIN service_request_interests sri ON sri.request_id = sr.id AND sri.installer_id = $1
      WHERE (sr.direct_installer_id IS NULL OR sr.direct_installer_id = $1)
        AND (sr.selected_installer_id = $1 OR sri.status IN ('interested', 'selected')
          OR (sr.status IN ('open', 'direct_pending') AND (sr.expires_at IS NULL OR sr.expires_at > NOW())))
    ), visible AS (
      SELECT *, CASE WHEN selected_by_me THEN 'selected'
        WHEN my_interest_id IS NOT NULL THEN 'interested' ELSE 'open' END AS workspace_tab,
        CASE WHEN same_city THEN 100 WHEN same_state THEN 82 ELSE 38 END AS match_score
      FROM candidates
      WHERE selected_by_me OR my_interest_id IS NOT NULL
        OR (status = 'open' AND (expires_at IS NULL OR expires_at > NOW())
          AND (same_city OR distance_km <= $6))
        OR (status = 'direct_pending' AND direct_installer_id = $1 AND expires_at > NOW())
    ), filtered AS (
      SELECT * FROM visible
      WHERE ($7 = 'all' OR workspace_tab = $7)
        AND ($16::integer IS NULL OR id = $16)
        AND ($10 = '' OR STRPOS(${fold("CONCAT_WS(' ', service_label, neighborhood, city, state, array_to_string(rooms, ' '))")}, $10) > 0)
        AND ($11 = '' OR ${fold('city')} = $11)
        AND ($12 = '' OR ${fold('state')} = $12)
        AND ($13 = '' OR place_type = $13)
        AND (NOT $14::boolean OR jsonb_array_length(COALESCE(photo_urls, '[]'::jsonb)) > 0)
    ), page AS (
      SELECT * FROM filtered
      ORDER BY CASE WHEN $15 = 'nearest' THEN distance_km END ASC NULLS LAST,
        CASE WHEN $15 = 'oldest' THEN created_at END ASC,
        CASE WHEN $15 <> 'oldest' THEN created_at END DESC, id DESC
      LIMIT $8 OFFSET $9
    )
    SELECT COALESCE((SELECT json_agg(page) FROM page), '[]'::json) AS opportunities,
      (SELECT COUNT(*)::integer FROM filtered) AS total,
      (SELECT json_build_object(
        'open', COUNT(*) FILTER (WHERE workspace_tab = 'open'),
        'interested', COUNT(*) FILTER (WHERE workspace_tab = 'interested'),
        'selected', COUNT(*) FILTER (WHERE workspace_tab = 'selected'),
        'matched', COUNT(*) FILTER (WHERE same_city OR distance_km <= $6)
      ) FROM visible) AS stats,
      COALESCE((SELECT json_agg(region) FROM (
        SELECT DISTINCT city, state FROM visible
        WHERE ($7 = 'all' OR workspace_tab = $7) AND NULLIF(city, '') IS NOT NULL
        ORDER BY city, state
      ) region), '[]'::json) AS regions
  `, values);
  const data = result.rows[0] || { opportunities: [], total: 0, stats: {}, regions: [] };
  return { ...data, limit: options.limit, offset: options.offset, has_more: options.offset + data.opportunities.length < data.total };
}

module.exports = { getOpportunityListing, normalizeListingOptions, parseOpportunityId };
