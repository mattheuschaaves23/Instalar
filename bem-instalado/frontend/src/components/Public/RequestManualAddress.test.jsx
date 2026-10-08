import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RequestManualAddress from './RequestManualAddress';
import { EMPTY_MANUAL_ADDRESS } from '../../utils/requestAddress';

it('oferece campos acessíveis, todos os estados e consulta opcional de CEP', () => {
  const markup = renderToStaticMarkup(<RequestManualAddress address={EMPTY_MANUAL_ADDRESS} />);
  expect(markup).toContain('Rua ou referência do local *');
  expect(markup).toContain('Cidade *');
  expect(markup).toContain('Estado *');
  expect(markup).toContain('O mapa não é obrigatório.');
  expect((markup.match(/<option /g) || []).length).toBe(28);
  expect(markup).toMatch(/<button disabled=""/);
});

it('mantém o endereço preenchido e habilita busca somente com CEP completo', () => {
  const markup = renderToStaticMarkup(<RequestManualAddress address={{ ...EMPTY_MANUAL_ADDRESS, zipCode: '88137-620', street: 'Rua Turquesa', state: 'SC' }} />);
  expect(markup).toContain('value="Rua Turquesa"');
  expect(markup).toContain('<option value="SC" selected="">');
  expect(markup).not.toMatch(/<button disabled/);
});

it('mostra a rua encontrada pelo GPS e aviso pequeno de precisão, mantendo campos editáveis', () => {
  const address = { ...EMPTY_MANUAL_ADDRESS, street: 'Rua Turquesa', neighborhood: 'Bela Vista', city: 'Palhoça', state: 'SC' };
  const markup = renderToStaticMarkup(<RequestManualAddress address={address} gps gpsAccuracy={20} />);
  expect(markup).toContain('Rua encontrada pelo GPS. Confira o endereço');
  expect(markup).toContain('value="Rua Turquesa"');
  expect(markup).toContain('value="Bela Vista"');
  expect(markup).toContain('OpenStreetMap');
  expect(markup).toContain('O número deve ser informado por você.');
  const imprecise = renderToStaticMarkup(<RequestManualAddress address={address} gps gpsAccuracy={800} />);
  expect(imprecise).toContain('GPS com baixa precisão');
});
