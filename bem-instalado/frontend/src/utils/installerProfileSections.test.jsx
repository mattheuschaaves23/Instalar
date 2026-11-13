import { describe, expect, it } from 'vitest';
import { readClientRequestTrackingHash } from './clientRequest';
import { buildProfileSectionHash, readProfileSection } from './installerProfileSections';

describe('abas do perfil do instalador', () => {
  it.each(['projetos', 'agenda', 'avaliacoes', 'informacoes', 'avaliar-instalador'])('preserva o link direto para %s', (section) => {
    expect(readProfileSection(buildProfileSectionHash(section))).toBe(section);
  });

  it('preserva o acesso ao pedido no fragmento ao trocar de aba', () => {
    const token = '1234567890abcdef1234567890abcdef1234567890abcdef';
    const hash = `#pedido=42&acesso=${token}`;
    const agenda = buildProfileSectionHash('agenda', hash);
    expect(readProfileSection(hash)).toBe('');
    expect(readProfileSection(agenda)).toBe('agenda');
    const reviews = buildProfileSectionHash('avaliacoes', agenda);
    expect(readProfileSection(reviews)).toBe('avaliacoes');
    expect(readClientRequestTrackingHash(reviews)).toMatchObject({ id: 42, client_access_token: token });
  });

  it('ignora fragmentos desconhecidos', () => {
    expect(readProfileSection('#outro')).toBe('');
    expect(buildProfileSectionHash('outro')).toBe('#projetos');
  });
});
