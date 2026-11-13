import { describe, expect, it } from 'vitest';
import { getInstallerRequirements } from './installerRequirements';

describe('lista essencial do perfil', () => {
  it('não exige certificado, foto, preços, garantia ou portfólio', () => {
    const list = getInstallerRequirements({
      name: 'Instalador QA', phone: '+55 (48) 99999-9999', city: 'Palhoça', state: 'sc',
      email: 'qa@example.test', email_verified: true,
    });
    expect(list).toHaveLength(5);
    expect(list.every(({complete}) => complete)).toBe(true);
  });

  it('indica todos os campos essenciais ausentes sem usar a porcentagem do perfil', () => {
    expect(getInstallerRequirements({}).filter(({complete}) => !complete).map(({field}) => field))
      .toEqual(['name', 'phone', 'city', 'state', 'email_verified']);
  });
});
