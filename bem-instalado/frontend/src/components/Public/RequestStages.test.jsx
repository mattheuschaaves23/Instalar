import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { RequestDetails, RequestReview, formatReviewMeasurements } from './RequestStages';
import RequestLocationMap, { getLocationMapUrls } from './RequestLocationMap';

const Icon = ({ name }) => <svg data-icon={name} />;
const request = { service: 'textured', materialStatus: 'bought', measurementStatus: 'known',
  wallSize: '3 m x 2,6 m', rollCount: '4', urgency: 'days', contactPreference: 'whatsapp' };
const snapshot = { ...request, serviceLabel: 'Texturizado', placeLabel: 'Casa ou apartamento', room: 'Sala, Quarto',
  materialLabel: 'Já comprei o papel', measurementDetail: '3 m x 2,6 m / 4',
  addressReference: 'Rua de teste, 10', city: 'Campinas', state: 'SP', photoCount: 0, details: '' };
const materialOptions = [
  { value: 'bought', label: 'Já comprei o papel' }, { value: 'need-help', label: 'Preciso de ajuda para comprar' },
  { value: 'not-sure', label: 'Ainda não sei o material' },
];
const measurementOptions = [
  { value: 'unknown', label: 'Não sei as medidas' }, { value: 'known', label: 'Tenho as medidas' },
  { value: 'visit', label: 'Quero visita técnica' },
];
function detailsMarkup(overrides = {}) {
  return renderToStaticMarkup(<RequestDetails request={{ ...request, ...overrides }} rooms={['Sala', 'Quarto']}
    roomOptions={['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Corredor', 'Comercial', 'Outro ambiente']}
    materialOptions={materialOptions} measurementOptions={measurementOptions} onChange={vi.fn()}
    onToggleRoom={vi.fn()} onMeasurementChange={vi.fn()} Icon={Icon} />);
}
function reviewMarkup(overrides = {}) {
  return renderToStaticMarkup(<RequestReview request={request} snapshot={{ ...snapshot, ...overrides }}
    urgencyOptions={[{ value: 'days', label: 'Próximos dias' }]} contactOptions={[{ value: 'whatsapp', label: 'WhatsApp' }]}
    onChange={vi.fn()} onEdit={vi.fn()} Icon={Icon} />);
}

describe('etapas compactas do pedido', () => {
  it('mantém todas as escolhas e expõe corretamente suas seleções', () => {
    const markup = detailsMarkup();
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(4);
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(9);
    expect(markup).toContain('Em quais ambientes?');
    expect(markup).toContain('Você já tem o papel?');
    expect(markup).toContain('Medidas da instalação');
  });
  it('mostra os campos editáveis preenchidos somente quando há medidas', () => {
    expect(detailsMarkup()).toContain('value="3 m x 2,6 m"');
    expect(detailsMarkup()).toContain('value="4"');
    expect(detailsMarkup({ measurementStatus: 'unknown' })).not.toContain('<input');
    expect(detailsMarkup({ measurementStatus: 'visit' })).not.toContain('<input');
    expect(detailsMarkup({ measurementStatus: 'visit' })).toContain('combina uma visita');
  });
  it('exibe o resumo real e quatro acessos distintos para editar', () => {
    const markup = reviewMarkup();
    for (const label of ['Serviço', 'Ambientes e material', 'Medidas', 'Localização', 'Texturizado', 'Campinas, SP', 'Sala, Quarto']) {
      expect(markup).toContain(label);
    }
    expect(markup.match(/aria-label="Editar /g)).toHaveLength(4);
    expect(markup).toContain('3 m x 2,6 m · 4 rolos');
    expect(markup).not.toContain('Publicado');
  });
  it('preserva observações e fotos no resumo quando adicionadas', () => {
    const markup = reviewMarkup({ details: '<script>teste</script>', photoCount: 2 });
    expect(markup).toContain('&lt;script&gt;teste&lt;/script&gt;');
    expect(markup).toContain('2 fotos adicionadas');
    expect(markup).toContain('Editar observações e fotos');
  });
  it('não duplica a unidade em quantidades descritivas e trata singular e medidas ausentes', () => {
    expect(formatReviewMeasurements({ ...snapshot, rollCount: '1' })).toBe('3 m x 2,6 m · 1 rolo');
    expect(formatReviewMeasurements({ ...snapshot, rollCount: '4 rolos no total' })).toBe('3 m x 2,6 m · 4 rolos no total');
    expect(formatReviewMeasurements({ ...snapshot, wallSize: '', rollCount: '', measurementDetail: 'Medidas informadas depois' })).toBe('Medidas informadas depois');
    expect(formatReviewMeasurements({ measurementStatus: 'visit', measurementDetail: 'Visita técnica solicitada' })).toBe('Visita técnica solicitada');
  });
});

describe('mapa do endereço selecionado', () => {
  it('não inventa coordenadas nem carrega mapas antes da seleção', () => {
    for (const target of [null, {}, { latitude: null, longitude: null }, { latitude: '', longitude: '' },
      { latitude: NaN, longitude: -47 }, { latitude: 100, longitude: -47 }, { latitude: -22, longitude: 181 }]) {
      expect(getLocationMapUrls(target)).toBeNull();
    }
    expect(renderToStaticMarkup(<RequestLocationMap target={null} />)).not.toContain('<iframe');
  });
  it('centraliza o mapa nas coordenadas reais e inclui o marcador', () => {
    const urls = getLocationMapUrls({ latitude: -22.9, longitude: -47.06 });
    const parsed = new URL(urls.embed);
    expect(parsed.origin).toBe('https://www.openstreetmap.org');
    expect(parsed.searchParams.get('marker')).toBe('-22.9,-47.06');
    const markup = renderToStaticMarkup(<RequestLocationMap target={{ latitude: -22.9, longitude: -47.06 }} />);
    expect(markup).toContain('Mapa do endereço selecionado');
    expect(markup).toContain('Abrir mapa');
    expect(markup).toContain('loading="lazy"');
  });
  it('trata zero como coordenada válida, sem confundir com um valor ausente', () => {
    expect(getLocationMapUrls({ latitude: 0, longitude: 0 }).embed).toContain('marker=0%2C0');
  });
  it('identifica GPS como região aproximada em vez de afirmar endereço exato', () => {
    const markup = renderToStaticMarkup(<RequestLocationMap target={{ latitude: -22.9, longitude: -47.06 }} regionOnly />);
    expect(markup).toContain('Mapa da região encontrada pelo GPS');
    expect(markup).toContain('Localização aproximada');
  });
  it('a rua encontrada pelo GPS usa marcador original e aviso de conferência', () => {
    const markup = renderToStaticMarkup(<RequestLocationMap target={{ latitude: -23.561414, longitude: -46.655881, source: 'gps' }} />);
    expect(markup).toContain('Mapa da localização aproximada pelo GPS');
    expect(markup).toContain('Confira a rua e informe o número.');
    expect(markup).toContain('-23.561414');
    expect(markup).toContain('-46.655881');
  });
  it('permite o mapa na política de segurança de produção sem liberar qualquer iframe', () => {
    const vercel = JSON.parse(readFileSync(new URL('../../../../../vercel.json', import.meta.url), 'utf8'));
    const policy = vercel.headers[0].headers.find((header) => header.key === 'Content-Security-Policy').value;
    const frames = policy.split(';').find((directive) => directive.trim().startsWith('frame-src'));
    expect(frames).toContain('https://www.openstreetmap.org');
    expect(frames).not.toContain('*');
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
