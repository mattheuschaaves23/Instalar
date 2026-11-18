import { PROFILE_ACCENTS, PROFILE_APPEARANCE_DEFAULTS, normalizeProfileAppearance } from '../../../../shared/profileAppearance.mjs';

export default function ProfileAppearanceEditor({ value, onChange, disabled }) {
  const appearance = normalizeProfileAppearance(value);
  const change = (key, next) => onChange({ ...appearance, [key]: next });
  return (
    <section aria-labelledby="profile-appearance-title" className="profile-appearance-editor profile-editor-full">
      <div className="profile-appearance-heading">
        <div><h3 id="profile-appearance-title">Deixe o perfil com a sua cara</h3><p>A prévia acompanha suas escolhas. Elas só são publicadas quando você salva.</p></div>
        <button className="profile-inline-button" disabled={disabled} onClick={() => onChange({ ...PROFILE_APPEARANCE_DEFAULTS })} type="button">Restaurar estilo padrão</button>
      </div>
      <fieldset className="profile-color-options" disabled={disabled}>
        <legend>Cor de destaque</legend>
        {Object.entries(PROFILE_ACCENTS).map(([key, palette]) => (
          <label key={key}>
            <input checked={appearance.accent === key} name="profile-accent" onChange={() => change('accent', key)} type="radio" value={key} />
            <span aria-hidden="true" style={{ backgroundColor: palette.color }} />
            {palette.label}
          </label>
        ))}
      </fieldset>
      <div className="profile-appearance-controls">
        <label><span className="field-label">Altura da capa</span>
          <select className="field-input" disabled={disabled} onChange={(event) => change('cover_height', event.target.value)} value={appearance.cover_height}>
            <option value="compact">Compacta</option><option value="standard">Destaque</option><option value="immersive">Panorâmica</option>
          </select>
        </label>
        <label><span className="field-label">Formato das publicações</span>
          <select className="field-input" disabled={disabled} onChange={(event) => change('gallery_format', event.target.value)} value={appearance.gallery_format}>
            <option value="landscape">Paisagem · ambientes completos</option><option value="square">Quadrado · estilo rede social</option><option value="portrait">Retrato · mais altura</option>
          </select>
        </label>
        <label className="profile-editor-full"><span className="field-label">Enquadramento da capa</span>
          <input aria-valuetext={`${appearance.cover_position}% — do topo para a base`} disabled={disabled} max="100" min="0" onChange={(event) => change('cover_position', Number(event.target.value))} step="1" type="range" value={appearance.cover_position} />
          <span className="profile-cover-range-labels"><span>Topo da foto</span><span>Base da foto</span></span>
        </label>
      </div>
      <p className="field-hint">A primeira publicação é sua capa. Em Publicações, use “Usar como capa” para escolher outra foto. Seu nome, bio e foto também podem ser personalizados nesta seção.</p>
    </section>
  );
}
