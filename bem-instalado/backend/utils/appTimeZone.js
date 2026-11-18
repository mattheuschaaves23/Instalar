// Fuso dos usuarios do InstalarPro. O servidor (Vercel) roda em UTC, entao todo
// horario digitado sem fuso (datetime-local do app e do site) precisa ser lido
// como horario de Sao Paulo, e nao como horario do processo.
const APP_TIME_ZONE = 'America/Sao_Paulo';

// "Hoje" no fuso do usuario, para SQL (CURRENT_DATE e a data em UTC no Neon).
const SQL_LOCAL_TODAY = `(NOW() AT TIME ZONE '${APP_TIME_ZONE}')::date`;
const sqlLocal = (column) => `(${column} AT TIME ZONE '${APP_TIME_ZONE}')`;

const NAIVE_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?)?$/;
const ZONED_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

const formatterCache = new Map();
function partsFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }));
  }
  return formatterCache.get(timeZone);
}

function wallClockParts(instant, timeZone = APP_TIME_ZONE) {
  const parts = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return parts;
}

// Diferenca (ms) entre o relogio local do fuso e o UTC naquele instante.
function zoneOffsetMs(instantMs, timeZone) {
  const wholeSecond = Math.floor(instantMs / 1000) * 1000;
  const p = wallClockParts(new Date(wholeSecond), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - wholeSecond;
}

// Aceita "AAAA-MM-DD HH:mm[:ss]" ou "AAAA-MM-DDTHH:mm[:ss]" (horario de Sao Paulo),
// "AAAA-MM-DD" (meia-noite em Sao Paulo) ou ISO com Z/offset (instante exato).
function parseLocalDateTime(value, timeZone = APP_TIME_ZONE) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (ZONED_DATE_TIME.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = raw.match(NAIVE_DATE_TIME);
  if (!match) return null;
  const [year, month, day, hour = 0, minute = 0, second = 0] = match.slice(1).map((item) => (item === undefined ? undefined : Number(item)));
  if (hour > 23 || minute > 59 || second > 59) return null;

  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wallAsUtc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  // Duas passadas cobrem uma eventual volta do horario de verao.
  let instant = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  instant = wallAsUtc - zoneOffsetMs(instant, timeZone);
  return new Date(instant);
}

// "AAAA-MM-DD" do instante no fuso do usuario.
function localDateKey(value, timeZone = APP_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const p = wallClockParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

module.exports = {
  APP_TIME_ZONE,
  SQL_LOCAL_TODAY,
  localDateKey,
  parseLocalDateTime,
  sqlLocal,
  wallClockParts,
};
