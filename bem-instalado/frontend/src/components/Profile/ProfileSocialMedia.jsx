import { useRef } from 'react';
import { resolveProfileImage } from './profileMedia';

const imageTypes = 'image/png,image/jpeg,image/jpg,image/webp';
const paths = {
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  photos: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z M3 16l5-5 4 4 3-3 6 6 M16 9h.01',
  checklist: 'M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3 M9 3h6v4H9z M8 14l3 3 5-6',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M12 6v6l4 2',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'm10 6-6 6 6 6M4 12h16',
};

export function ProfileSocialIcon({ name, size = 20 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function ImagePicker({ children, inputLabel, disabled, onSelect, multiple = false, className = 'ghost-button' }) {
  const input = useRef(null);
  return <>
    <input
      accept={imageTypes}
      aria-label={inputLabel}
      disabled={disabled}
      hidden
      multiple={multiple}
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files || []);
        event.currentTarget.value = '';
        if (files.length) void onSelect(multiple ? files : files[0]);
      }}
      ref={input}
      type="file"
    />
    <button className={className} disabled={disabled} onClick={() => input.current?.click()} type="button">{children}</button>
  </>;
}

export function ProfileIdentityPreview({ form, apiBaseUrl, disabled, onChangePhoto, onOpenPublications }) {
  const name = form.business_name?.trim() || form.name?.trim() || 'Seu perfil';
  const initials = name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const photo = resolveProfileImage(form.installer_photo || form.logo, apiBaseUrl);
  const cover = resolveProfileImage(form.installation_gallery[0], apiBaseUrl) || photo;
  return (
    <div className="profile-social-identity">
      <div className="profile-social-cover">
        {cover ? <img alt="" src={cover} /> : <ProfileSocialIcon name="photos" size={36} />}
        <button className="ghost-button profile-social-cover-action" disabled={disabled} onClick={onOpenPublications} type="button">
          <ProfileSocialIcon name="photos" size={17} /> Gerenciar capa
        </button>
      </div>
      <div className="profile-social-identity-info">
        <div className="profile-social-avatar">
          {photo ? <img alt="Prévia da foto do perfil" src={photo} /> : <span aria-hidden="true">{initials}</span>}
        </div>
        <div className="profile-social-identity-copy">
          <strong>{name}</strong>
          <span>Como os clientes verão você</span>
        </div>
        <ImagePicker inputLabel="Enviar foto do perfil" disabled={disabled} onSelect={onChangePhoto}>
          <ProfileSocialIcon name="camera" size={18} /> {form.installer_photo ? 'Trocar foto' : 'Adicionar foto'}
        </ImagePicker>
      </div>
    </div>
  );
}

export function ProfilePublications({ photos, limit, apiBaseUrl, canEdit, uploading, onUpload, onCover, onRemove }) {
  const atLimit = photos.length >= limit;
  return (
    <div className="profile-publications">
      <div className="profile-publications-toolbar">
        <div>
          <strong>{photos.length === 1 ? '1 publicação' : `${photos.length} publicações`}</strong>
          <p>{atLimit ? `Limite de ${limit} fotos atingido. Remova uma para adicionar outra.` : `Até ${limit} fotos no seu plano. JPG, PNG ou WEBP de até 3 MB.`}</p>
        </div>
        <ImagePicker className="gold-button" disabled={!canEdit || atLimit} inputLabel="Selecionar fotos para publicar" multiple onSelect={onUpload}>
          <ProfileSocialIcon name="plus" size={18} /> {uploading ? 'Enviando…' : 'Nova publicação'}
        </ImagePicker>
      </div>
      {photos.length ? (
        <ul className="profile-publications-grid">
          {photos.map((photo, index) => (
            <li className="profile-publication" key={`${index}-${photo}`}>
              <div className="profile-publication-photo">
                <img alt={`Foto do projeto ${index + 1}`} decoding="async" loading="lazy" src={resolveProfileImage(photo, apiBaseUrl)} />
                {index === 0 ? <span>Capa do perfil</span> : null}
              </div>
              <div className="profile-publication-actions">
                {index > 0 ? <button aria-label={`Usar projeto ${index + 1} como capa`} disabled={!canEdit} onClick={() => onCover(index)} type="button">Usar como capa</button> : null}
                <button aria-label={`Remover publicação ${index + 1}`} disabled={!canEdit} onClick={() => onRemove(index)} type="button">Remover</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="profile-publications-empty">
          <ProfileSocialIcon name="photos" size={30} />
          <strong>Seu portfólio começa aqui</strong>
          <p>Adicione a foto de uma instalação. Ela também será a capa do seu perfil.</p>
        </div>
      )}
      <p className="field-hint">As mudanças aparecem no seu perfil depois de salvar.</p>
    </div>
  );
}
