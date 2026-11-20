import { describe, expect, it } from 'vitest';
import { installerRating, starFillPercent } from './installerRating';

describe('nota pública do instalador', () => {
  it('exibe 2,5 para perfis sem avaliações, sem inventar uma avaliação', () => {
    expect(installerRating({ average_rating: 0, review_count: '0' })).toEqual({
      value: 2.5, formatted: '2,5', isInitial: true, reviewCount: 0, reviewsLabel: '0 avaliações',
    });
  });

  it.each([['1.0', 1, '1,0'], ['4.75', 4, '4,8'], ['2.50', 2, '2,5']])(
    'usa a média real %s quando tem %i avaliações',
    (average_rating, review_count, formatted) => {
      expect(installerRating({ average_rating, review_count })).toMatchObject({ formatted, reviewCount: review_count, isInitial: false });
    },
  );

  it('preenche duas estrelas e meia, sem arredondar para três', () => {
    expect(Array.from({ length: 5 }, (_, index) => starFillPercent(2.5, index))).toEqual([100, 100, 50, 0, 0]);
  });
});
