import { BRAZIL_STATE_OPTIONS, postalDigits } from '../../utils/requestAddress';
import { describeGpsAddress } from '../../utils/requestGeolocation';

export default function RequestManualAddress({ address, onChange, onLookupPostal, lookingUp, gps = false, gpsAccuracy = null }) {
  return (
    <fieldset className="request-manual-address">
      <legend>Endereço da instalação</legend>
      {gps ? <>
        <p className="request-gps-feedback" role="status">{describeGpsAddress(address, gpsAccuracy)}</p>
        <p className="request-gps-credit">Dados de <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>. O número deve ser informado por você.</p>
      </> : <p>Use o CEP para preencher ou digite o endereço. O mapa não é obrigatório.</p>}
      <div className="request-manual-grid">
        <label className="request-editable-field request-manual-cep">
          <span>CEP <small>(opcional)</small></span>
          <div className="request-postal-input">
            <input aria-label="CEP (opcional)" autoComplete="postal-code" inputMode="numeric" maxLength={9} onChange={(event) => onChange('zipCode', event.target.value)}
              placeholder="00000-000" value={address.zipCode} />
            <button disabled={lookingUp || postalDigits(address.zipCode).length !== 8} onClick={onLookupPostal} type="button">
              {lookingUp ? 'Buscando…' : 'Buscar CEP'}
            </button>
          </div>
        </label>
        <label className="request-editable-field request-manual-street">
          <span>Rua ou referência do local *</span>
          <input autoComplete="address-line1" maxLength={160} onChange={(event) => onChange('street', event.target.value)}
            placeholder="Nome da rua, estrada ou local" value={address.street} />
        </label>
        <label className="request-editable-field request-manual-number">
          <span>Número <small>(opcional)</small></span>
          <input maxLength={20} onChange={(event) => onChange('number', event.target.value)} placeholder="Ex.: 120 ou s/n" value={address.number} />
        </label>
        <label className="request-editable-field request-manual-neighborhood">
          <span>Bairro <small>(opcional)</small></span>
          <input maxLength={100} onChange={(event) => onChange('neighborhood', event.target.value)} value={address.neighborhood} />
        </label>
        <label className="request-editable-field request-manual-complement">
          <span>Complemento <small>(opcional)</small></span>
          <input autoComplete="address-line2" maxLength={100} onChange={(event) => onChange('complement', event.target.value)}
            placeholder="Casa, bloco, apartamento…" value={address.complement} />
        </label>
        <label className="request-editable-field request-manual-city">
          <span>Cidade *</span>
          <input autoComplete="address-level2" maxLength={100} onChange={(event) => onChange('city', event.target.value)} value={address.city} />
        </label>
        <label className="request-editable-field request-manual-state">
          <span>Estado *</span>
          <select autoComplete="address-level1" onChange={(event) => onChange('state', event.target.value)} value={address.state}>
            <option value="">UF</option>
            {BRAZIL_STATE_OPTIONS.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
