export const GPS_TARGET_ACCURACY = 30;
export const GPS_TIMEOUT = 6000;

export function getPreciseBrowserPosition(signal, { geolocation = globalThis.navigator?.geolocation,
  timeout = GPS_TIMEOUT, targetAccuracy = GPS_TARGET_ACCURACY } = {}) {
  return new Promise((resolve, reject) => {
    if (!geolocation) { reject(new Error('Localização automática indisponível.')); return; }
    let bestPosition = null;
    let watchId = null;
    let timer = null;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) geolocation.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => finish(reject, new DOMException('Busca cancelada', 'AbortError'));
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      watchId = geolocation.watchPosition((position) => {
        const coords = position?.coords;
        if (!Number.isFinite(coords?.latitude) || !Number.isFinite(coords?.longitude) ||
          Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) return;
        const accuracy = Number.isFinite(coords.accuracy) && coords.accuracy >= 0 ? coords.accuracy : Infinity;
        const bestAccuracy = Number.isFinite(bestPosition?.coords?.accuracy) && bestPosition.coords.accuracy >= 0
          ? bestPosition.coords.accuracy : Infinity;
        if (!bestPosition || accuracy < bestAccuracy) bestPosition = position;
        if (accuracy <= targetAccuracy) finish(resolve, bestPosition);
      }, (error) => {
        if (error?.code === 1) finish(reject, error);
      }, { enableHighAccuracy: true, timeout, maximumAge: 0 });
      if (settled) { geolocation.clearWatch(watchId); return; }
      timer = setTimeout(() => bestPosition
        ? finish(resolve, bestPosition)
        : finish(reject, new Error('LOCATION_TIMEOUT')), timeout);
    } catch (error) { finish(reject, error); }
  });
}

export function describeGpsAddress(address, accuracy) {
  if (!String(address.street || '').trim()) {
    return 'Encontramos sua região, mas a rua não está cadastrada no mapa. Informe a rua ou uma referência para continuar.';
  }
  const precise = typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0;
  if (!precise || accuracy > 100) {
    const distance = accuracy >= 1000
      ? `${(accuracy / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
      : `${Math.round(accuracy).toLocaleString('pt-BR')} m`;
    const range = precise ? ` (margem aproximada de ${distance})` : '';
    return `GPS com baixa precisão${range}. A rua sugerida pode estar incorreta. Confira o endereço ou use o CEP.`;
  }
  return 'Rua encontrada pelo GPS. Confira o endereço e informe o número.';
}

export function manualAddressFromGps(location) {
  return { zipCode: location.zipCode || '', street: location.street || '', number: '', complement: '',
    neighborhood: location.neighborhood || '', city: location.city || '', state: location.state || '' };
}
