import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import RequestIcon, { REQUEST_ICON_SOURCES } from './RequestIcon';

const requiredIcons = [
  'home', 'building', 'map-pin', 'roller', 'texture', 'sticker', 'question',
  'sofa', 'bed', 'utensils', 'shower', 'door', 'store', 'dots', 'cart',
  'pencil-ruler', 'ruler', 'worker', 'plus', 'search', 'target', 'address-pin',
  'bolt', 'calendar', 'clock', 'whatsapp', 'phone', 'mail', 'box', 'shield', 'arrow-right', 'check',
];

describe('ícones recortados dos modelos aprovados', () => {
  it('usa um arquivo PNG local para cada desenho das quatro etapas', () => {
    expect(Object.keys(REQUEST_ICON_SOURCES).sort()).toEqual([...requiredIcons].sort());
    for (const name of requiredIcons) {
      const markup = renderToStaticMarkup(<RequestIcon name={name} />);
      expect(markup).toContain(`<img alt="" aria-hidden="true"`);
      expect(markup).toContain('request-image-icon');
      expect(markup).toContain(`/${name}.png`);
      expect(markup).not.toContain('<svg');
    }
  });

  it('usa o recorte da marca de seleção e mantém suporte aos outros ícones', () => {
    const Fallback = ({ name }) => <svg data-icon={name} />;
    expect(renderToStaticMarkup(<RequestIcon name="check" Fallback={Fallback} />)).toContain('/check.png');
    expect(renderToStaticMarkup(<RequestIcon name="bell" Fallback={Fallback} />)).toContain('data-icon="bell"');
    expect(renderToStaticMarkup(<RequestIcon name="unknown" />)).toBe('');
  });

  it('entrega desenhos pequenos com transparência e rastreia os recortes originais', () => {
    const assetDirectory = new URL('../../assets/request-icons/', import.meta.url);
    const provenance = JSON.parse(readFileSync(new URL('provenance.json', assetDirectory), 'utf8'));
    for (const name of requiredIcons) {
      const png = readFileSync(new URL(`${name}.png`, assetDirectory));
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png[25]).toBe(6); // PNG color type RGBA (includes transparent background).
      expect(png.readUInt32BE(16)).toBe(png.readUInt32BE(20));
      expect(png.length).toBeLessThan(4000);
      expect(provenance.icons[name].crop).toHaveLength(4);
    }
  });
});
