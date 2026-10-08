export function getLocationMapUrls(target) {
  if (target?.latitude == null || target?.longitude == null || target.latitude === '' || target.longitude === '') return null;
  const latitude = Number(target.latitude);
  const longitude = Number(target.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const bbox = [
    Math.max(-180, longitude - 0.01), Math.max(-85.0511, latitude - 0.004),
    Math.min(180, longitude + 0.01), Math.min(85.0511, latitude + 0.004),
  ];
  if (bbox[1] >= bbox[3]) return null;
  const params = new URLSearchParams({ bbox: bbox.join(','), layer: 'mapnik', marker: `${latitude},${longitude}` });
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?${params}`,
    full: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`,
  };
}

export default function RequestLocationMap({ target, regionOnly = false }) {
  const urls = getLocationMapUrls(target);
  const gps = target?.source === 'gps';
  return (
    <div className="request-location-map-block">
      <div className={`request-location-map${urls ? '' : ' is-empty'}`}>
        {urls ? (
          <iframe key={urls.embed} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
            src={urls.embed} title={gps ? 'Mapa da localização aproximada pelo GPS' : regionOnly ? 'Mapa da região encontrada pelo GPS' : 'Mapa do endereço selecionado'} />
        ) : (
          <div className="request-map-empty">
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
              <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" /><circle cx="12" cy="10" r="2.4" />
            </svg>
            <span>Selecione um endereço para visualizar o mapa.</span>
          </div>
        )}
      </div>
      <div className="request-map-caption">
        <span>{gps ? 'Ponto aproximado do GPS. Confira a rua e informe o número.' : regionOnly ? 'Localização aproximada. Digite a rua para informar o endereço exato.' : 'Confira o local antes de continuar.'}</span>
        {urls ? <a href={urls.full} rel="noopener noreferrer" target="_blank">Abrir mapa</a> : null}
      </div>
    </div>
  );
}
