function Choice({ label, icon, selected, onClick, Icon }) {
  return (
    <button
      aria-pressed={selected}
      className={`request-choice${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="request-choice-icon" aria-hidden="true"><Icon name={icon} /></span>
      <strong>{label}</strong>
      {selected ? <span className="request-choice-check" aria-hidden="true"><Icon name="check" /></span> : null}
    </button>
  );
}

const ROOM_ICONS = {
  Sala: 'sofa', Quarto: 'bed', Cozinha: 'utensils', Banheiro: 'shower',
  Corredor: 'door', Comercial: 'store', 'Outro ambiente': 'dots',
};
const MATERIAL_ICONS = { bought: 'roller', 'need-help': 'cart', 'not-sure': 'question' };
const MEASUREMENT_ICONS = { unknown: 'pencil-ruler', known: 'ruler', visit: 'worker' };
const URGENCY_ICONS = { urgent: 'bolt', week: 'calendar', days: 'calendar', quote: 'clock' };
const CONTACT_ICONS = { whatsapp: 'whatsapp', phone: 'phone', any: 'mail' };

export function RequestDetails({
  request, rooms, roomOptions, materialOptions, measurementOptions,
  onToggleRoom, onChange, onMeasurementChange, Icon, children,
}) {
  return (
    <div className="client-app-request-panel client-app-request-panel--details">
      <div className="client-app-simple-heading">
        <div><h3>Detalhes do serviço</h3><p>Conte um pouco mais sobre a instalação.</p></div>
      </div>

      <section className="request-form-section" aria-labelledby="rooms-heading">
        <h4 id="rooms-heading">Em quais ambientes?</h4>
        <div className="request-choice-grid request-choice-grid--rooms" role="group" aria-label="Ambientes do serviço">
          {roomOptions.map((room) => (
            <Choice key={room} label={room} icon={ROOM_ICONS[room]} selected={rooms.includes(room)}
              onClick={() => onToggleRoom(room)} Icon={Icon} />
          ))}
        </div>
      </section>

      <section className="request-form-section" aria-labelledby="material-heading">
        <h4 id="material-heading">Você já tem o papel?</h4>
        <div className="request-choice-grid" role="group" aria-label="Status do material">
          {materialOptions.map((item) => (
            <Choice key={item.value} label={item.label} icon={MATERIAL_ICONS[item.value]}
              selected={request.materialStatus === item.value} onClick={() => onChange('materialStatus', item.value)} Icon={Icon} />
          ))}
        </div>
      </section>

      <section className="request-form-section" aria-labelledby="measure-heading">
        <h4 id="measure-heading">Medidas da instalação</h4>
        <div className="request-choice-grid" role="group" aria-label="Situação das medidas">
          {measurementOptions.map((item) => (
            <Choice key={item.value} label={item.label} icon={MEASUREMENT_ICONS[item.value]}
              selected={request.measurementStatus === item.value} onClick={() => onMeasurementChange(item.value)} Icon={Icon} />
          ))}
        </div>
        {request.measurementStatus === 'known' ? (
          <div className="request-measure-fields">
            <label className="request-editable-field">
              <span>Medida aproximada</span>
              <input onChange={(event) => onChange('wallSize', event.target.value)}
                placeholder="Ex.: 3 m x 2,6 m" value={request.wallSize} />
            </label>
            <label className="request-editable-field">
              <span>Quantidade de rolos</span>
              <input inputMode="numeric" onChange={(event) => onChange('rollCount', event.target.value)}
                placeholder="Ex.: 4" value={request.rollCount} />
            </label>
          </div>
        ) : request.measurementStatus ? (
          <p className="request-measure-hint">
            {request.measurementStatus === 'visit'
              ? 'O profissional combina uma visita para conferir as medidas antes do orçamento final.'
              : 'Sem problema: o profissional pode orientar as medidas e a quantidade de papel.'}
          </p>
        ) : null}
      </section>
      {children}
    </div>
  );
}

export function formatReviewMeasurements(snapshot) {
  if (snapshot.measurementStatus !== 'known') return snapshot.measurementDetail;
  const count = String(snapshot.rollCount || '').trim();
  const rolls = /^\d+$/.test(count) ? `${count} ${Number(count) === 1 ? 'rolo' : 'rolos'}` : count;
  return [snapshot.wallSize, rolls].filter(Boolean).join(' · ') || snapshot.measurementDetail;
}

export function RequestReview({ request, snapshot, locationLabel, urgencyOptions, contactOptions, onChange, onEdit, Icon }) {
  const summary = [
    { label: 'Serviço', value: snapshot.serviceLabel, detail: snapshot.placeLabel,
      icon: request.service === 'all' ? 'question' : request.service === 'vinyl' ? 'roller' : request.service === 'adhesive' ? 'sticker' : 'texture', step: 0 },
    { label: 'Ambientes e material', value: snapshot.room, detail: snapshot.materialLabel, icon: 'box', step: 1 },
    { label: 'Medidas', value: formatReviewMeasurements(snapshot), icon: 'ruler', step: 1 },
    { label: 'Localização', value: locationLabel || snapshot.addressReference || snapshot.neighborhood || snapshot.city,
      detail: [snapshot.city, snapshot.state].filter(Boolean).join(', '), icon: 'map-pin', step: 2 },
  ];

  return (
    <div className="client-app-request-panel client-app-request-panel--review">
      <div className="client-app-simple-heading">
        <div><h3>Revise seu pedido</h3><p>Escolha o prazo e a melhor forma de contato.</p></div>
      </div>
      <section className="request-form-section" aria-labelledby="urgency-heading">
        <h4 id="urgency-heading">Quando precisa?</h4>
        <div className="request-choice-grid request-choice-grid--urgency" role="group" aria-label="Prazo desejado">
          {urgencyOptions.map((item) => (
            <Choice key={item.value} label={item.label} icon={URGENCY_ICONS[item.value]}
              selected={request.urgency === item.value} onClick={() => onChange('urgency', item.value)} Icon={Icon} />
          ))}
        </div>
      </section>
      <section className="request-form-section" aria-labelledby="contact-heading">
        <h4 id="contact-heading">Como prefere falar?</h4>
        <div className="request-choice-grid" role="group" aria-label="Preferência de contato">
          {contactOptions.map((item) => (
            <Choice key={item.value} label={item.label} icon={CONTACT_ICONS[item.value]}
              selected={request.contactPreference === item.value} onClick={() => onChange('contactPreference', item.value)} Icon={Icon} />
          ))}
        </div>
      </section>
      <section className="request-form-section request-review-summary" aria-labelledby="summary-heading">
        <h4 id="summary-heading">Resumo do pedido</h4>
        <dl className="request-summary-grid">
          {summary.map((item) => (
            <div className="request-summary-item" key={item.label}>
              <span className="request-summary-icon" aria-hidden="true"><Icon name={item.icon} /></span>
              <div>
                <dt>{item.label}</dt>
                <dd><strong>{item.value || 'Não informado'}</strong>{item.detail ? <span>{item.detail}</span> : null}</dd>
              </div>
              <button aria-label={`Editar ${item.label.toLowerCase()}`} onClick={() => onEdit(item.step)} type="button">Editar</button>
            </div>
          ))}
        </dl>
        {snapshot.details || snapshot.photoCount ? (
          <div className="request-review-extras">
            {snapshot.details ? <p><strong>Observação:</strong> {snapshot.details}</p> : null}
            {snapshot.photoCount ? <p>{snapshot.photoCount} foto{snapshot.photoCount === 1 ? '' : 's'} adicionada{snapshot.photoCount === 1 ? '' : 's'}</p> : null}
            <button onClick={() => onEdit(1)} type="button">Editar observações e fotos</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
