import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProfileAppearanceEditor from './ProfileAppearanceEditor';
import { ProfileIdentityPreview } from './ProfileSocialMedia';
import { buildOwnerProfilePreview } from './profilePresentation';
import { buildProfileStepPayload } from './profileEditing';
import { normalizeProfileAppearance, profileAppearanceStyle } from '../../../../shared/profileAppearance.mjs';

describe('aparência personalizável', () => {
  const appearance = { accent: 'forest', cover_height: 'immersive', cover_position: 25, gallery_format: 'square' };
  it('mostra opções acessíveis e identificadas, sem publicar ao escolher', () => {
    const html = renderToStaticMarkup(<ProfileAppearanceEditor value={appearance} onChange={vi.fn()} />);
    expect(html).toContain('Cor de destaque');
    expect(html.match(/type="radio"/g)).toHaveLength(5);
    expect(html).toContain('Enquadramento da capa');
    expect(html).toContain('Restaurar estilo padrão');
    expect(html).toContain('quando você salva');
  });
  it('usa os mesmos ajustes no editor e na apresentação do cliente', () => {
    const profile = { id: 7, name: 'Maria', profile_appearance: appearance, installation_gallery: ['foto.jpg'] };
    const preview = buildOwnerProfilePreview(profile);
    expect(preview.installer.profile_appearance).toEqual(appearance);
    const html = renderToStaticMarkup(<ProfileIdentityPreview form={profile} disabled={false} />);
    expect(html).toContain('data-cover-height="immersive"');
    expect(html).toContain('data-gallery-format="square"');
    expect(html).toContain('--profile-cover-position:25%');
  });
  it('salva aparência somente na seção Perfil, nunca contatos ou permissões', () => {
    const form = { profile_appearance: appearance, phone: 'privado', public_profile: true, is_admin: true };
    expect(buildProfileStepPayload(form, 1)).toEqual({ profile_appearance: appearance });
    expect(buildProfileStepPayload(form, 3)).toEqual({});
  });
  it('limita estilos a tokens conhecidos e mantém compatibilidade com perfis antigos', () => {
    expect(profileAppearanceStyle({ accent: 'javascript:alert(1)', cover_position: 'top;display:none' }))
      .toEqual(profileAppearanceStyle(normalizeProfileAppearance(null)));
    expect(Object.keys(profileAppearanceStyle(appearance))).toHaveLength(4);
  });
});
