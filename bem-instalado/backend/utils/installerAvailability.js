const { localDateKey } = require('./appTimeZone');

const VALID_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function normalizeInstallationDays(value) {
  if (Array.isArray(value)) {
    return value.filter((day) => VALID_DAYS.includes(day));
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((day) => VALID_DAYS.includes(day));
  }

  return [];
}

// As datas candidatas sao meio-dia UTC (09:00 em Sao Paulo) do dia de Sao Paulo,
// entao a chave e o dia da semana saem dos campos UTC, sem depender do fuso do servidor.
function dateKey(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekdayKey(date) {
  return VALID_DAYS[date.getUTCDay()];
}

function buildAvailableDates(installationDays, busyDates = [], limit = 5) {
  const normalizedDays = normalizeInstallationDays(installationDays);

  if (!normalizedDays.length) {
    return [];
  }

  const blocked = new Set(
    busyDates
      .filter(Boolean)
      .map((value) => localDateKey(value))
  );

  const results = [];
  const [year, month, day] = localDateKey(new Date()).split('-').map(Number);

  for (let step = 0; step < 35 && results.length < limit; step += 1) {
    const candidate = new Date(Date.UTC(year, month - 1, day + step, 12, 0, 0, 0));

    if (!normalizedDays.includes(weekdayKey(candidate))) {
      continue;
    }

    const key = dateKey(candidate);

    if (blocked.has(key)) {
      continue;
    }

    results.push(candidate.toISOString());
  }

  return results;
}

module.exports = {
  buildAvailableDates,
  normalizeInstallationDays,
};
