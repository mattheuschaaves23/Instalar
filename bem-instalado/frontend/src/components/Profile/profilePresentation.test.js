import { describe, expect, it } from 'vitest';
import { buildOwnerProfilePreview } from './profilePresentation';
import { buildProfileStepPayload, clearProfileDraft, getProfileEditSection, moveProfilePhotoToCover, profileTutorialKey, readProfileDraft, rememberProfileDraft } from './profileEditing';
import { resolveProfileImage } from './profileMedia';

describe('dados apresentados ao próprio instalador', () => {
  it('projeta somente dados públicos, sem contatos, documentos ou configurações privadas', () => {
    const { installer } = buildOwnerProfilePreview({
      id: 7, name: 'Maria', business_name: 'Maria Instalações', city: 'Palhoça', state: 'SC',
      phone: '48999999999', email: 'privado@example.test', document_id: '12345678900',
      emergency_phone: '48988888888', emergency_contact: 'CONTATO PRIVADO',
      certificate_file: '/api/users/uploads/file/privado.pdf', monthly_goal: 6000,
      certification_verified: false, public_profile: false, installation_gallery: ['foto.jpg', '', null],
      password: 'NAO VAZAR', auth_version: 3, safety_notes: 'Uso EPIs', provides_warranty: true, warranty_days: 90,
    }, { summary: { review_count: 2, average_rating: 4.5 } });
    expect(installer.display_name).toBe('Maria Instalações');
    expect(installer.installation_gallery).toEqual(['foto.jpg']);
    expect(installer.certificate_verified).toBe(false);
    expect(installer.review_count).toBe(2);
    expect(installer.safety).toMatchObject({ provides_warranty: true, warranty_days: 90 });
    for (const field of ['email', 'phone', 'document_id', 'emergency_phone', 'emergency_contact', 'monthly_goal', 'password', 'auth_version', 'certificate_file']) {
      expect(installer).not.toHaveProperty(field);
    }
  });
  it('usa nome quando não existe empresa e tolera perfil sem mídia nem avaliações', () => {
    const result = buildOwnerProfilePreview({ id: 7, name: 'Maria', installation_gallery: null });
    expect(result.installer.display_name).toBe('Maria');
    expect(result.installer.installation_gallery).toEqual([]);
    expect(result.reviews).toEqual([]);
    expect(result.installer.review_count).toBe(0);
  });
});

describe('salvamento de uma etapa', () => {
  const form = { name: 'Maria', phone: '48999999999', city: 'Palhoça', state: 'SC', bio: 'Papel de parede',
    business_name: 'Maria', logo: '', installer_photo: '', installation_gallery: [], certificate_file: '', certificate_name: '',
    years_experience: 2, service_radius_km: 70, is_admin: true, email_verified: true, public_profile: true, certification_verified: true };
  it('salva essenciais sem enviar opcionais ou campos de autenticação/aprovação', () => {
    expect(buildProfileStepPayload(form, 0)).toEqual({ name: 'Maria', phone: '48999999999', city: 'Palhoça', state: 'SC' });
  });
  it('salva apresentação sem afetar dados essenciais ou aprovação do certificado', () => {
    const payload = buildProfileStepPayload(form, 1);
    expect(payload.bio).toBe('Papel de parede');
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('installation_gallery');
    expect(payload).not.toHaveProperty('certification_verified');
    expect(payload).not.toHaveProperty('public_profile');
    expect(payload).not.toHaveProperty('is_admin');
  });
  it('salva atendimento sem sobrescrever os dados da apresentação', () => {
    const payload = buildProfileStepPayload(form, 2);
    expect(payload.service_radius_km).toBe(70);
    expect(payload).not.toHaveProperty('bio');
    expect(payload).not.toHaveProperty('email_verified');
  });
  it('não envia nada para uma etapa desconhecida', () => {
    expect(buildProfileStepPayload(form, -1)).toEqual({});
  });
  it('abre a apresentação por padrão e permite atalhos para publicações e requisitos', () => {
    expect(getProfileEditSection(null)).toBe(1);
    expect(getProfileEditSection('outro')).toBe(1);
    expect(getProfileEditSection('publicacoes')).toBe(3);
    expect(getProfileEditSection('dados')).toBe(0);
  });
  it('salva publicações sem sobrescrever fotos do perfil, bio ou dados privados', () => {
    expect(buildProfileStepPayload({ ...form, installation_gallery: ['foto-a'] }, 3)).toEqual({ installation_gallery: ['foto-a'] });
  });
  it('define a capa sem duplicar ou perder fotos nem alterar a lista original', () => {
    const gallery = ['a', 'b', 'c', 'd'];
    expect(moveProfilePhotoToCover(gallery, 2)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveProfilePhotoToCover(gallery, 0)).toBe(gallery);
    expect(moveProfilePhotoToCover(gallery, 5)).toBe(gallery);
    expect(gallery).toEqual(['a', 'b', 'c', 'd']);
  });
  it('lembra o tutorial separadamente para cada instalador', () => {
    expect(profileTutorialKey(7)).not.toBe(profileTutorialKey(8));
    expect(profileTutorialKey(7)).toBe(profileTutorialKey('7'));
  });
  it('restaura apenas os campos alterados para a mesma conta e esquece o rascunho descartado', () => {
    rememberProfileDraft(7, 0, { ...form, city: 'São José' }, form);
    expect(readProfileDraft(7)).toMatchObject({ step: 0, changes: { city: 'São José' } });
    expect(readProfileDraft(8)).toBeNull();
    clearProfileDraft(7);
    expect(readProfileDraft(7)).toBeNull();
  });
});

describe('mídia do perfil em outra origem', () => {
  it('resolve o arquivo público no host da API, não na origem do Android', () => {
    expect(resolveProfileImage('/api/public/assets/foto.webp', 'https://instalar.example/api')).toBe('https://instalar.example/api/public/assets/foto.webp');
  });
  it('preserva caminhos no site e não transforma documentos privados ou fotos externas', () => {
    expect(resolveProfileImage('/api/public/assets/foto.webp', '/api')).toBe('/api/public/assets/foto.webp');
    expect(resolveProfileImage('/api/users/uploads/file/privado.pdf', 'https://instalar.example/api')).toBe('/api/users/uploads/file/privado.pdf');
    expect(resolveProfileImage('https://cdn.example/foto.webp', 'https://instalar.example/api')).toBe('https://cdn.example/foto.webp');
  });
});
