export function resolveProfileImage(value, apiBase) {
  if (typeof value !== 'string' || !value.startsWith('/api/public/assets/') || !/^https?:\/\//i.test(apiBase || '')) return value;
  return `${apiBase.replace(/\/+$/, '')}${value.slice('/api'.length)}`;
}
