import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import BrandImage from './BrandImage';
import BrandWordmark from './BrandWordmark';
import BrandMark from './BrandMark';
import { BRAND_IMAGES, BRAND_NAME } from '../../utils/brandAssets';

describe('nova identidade InstalarPro', () => {
  it.each(['logo', 'wordmark', 'mark'])('usa versões originais claras e escuras de %s', (variant) => {
    for (const surface of ['light', 'dark']) {
      const asset = BRAND_IMAGES[variant][surface];
      const markup = renderToStaticMarkup(<BrandImage variant={variant} surface={surface} />);
      expect(markup).toContain(`src="${asset.src}"`);
      expect(markup).toContain(`data-brand-surface="${surface}"`);
      expect(markup).toContain(`Logo ${BRAND_NAME}`);
      const png = readFileSync(new URL(`../../../public${asset.src}`, import.meta.url));
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
    }
  });

  it('evita slogan ilegível em cabeçalhos pequenos e preserva logo completa em tamanhos maiores', () => {
    expect(renderToStaticMarkup(<BrandWordmark size="sm" />)).toContain('wordmark-light.png');
    expect(renderToStaticMarkup(<BrandWordmark size="lg" surface="dark" />)).toContain('logo-dark.png');
    expect(renderToStaticMarkup(<BrandMark />)).toContain('mark-light.png');
  });

  it('usa ícones reais nas dimensões informadas no manifesto', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../public/manifest.webmanifest', import.meta.url), 'utf8'));
    expect(manifest.short_name).toBe(BRAND_NAME);
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
    for (const icon of manifest.icons) {
      const png = readFileSync(new URL(`../../../public${icon.src}`, import.meta.url));
      expect(icon.sizes).toBe(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
    }
  });
});
