const INITIAL_INSTALLER_RATING = 2.5;
const ratingFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatStarRating(value) {
  return ratingFormatter.format(Number(value) || 0);
}

export function installerRating({ average_rating, review_count } = {}) {
  const reviewCount = Math.max(0, Number(review_count) || 0);
  const isInitial = reviewCount === 0;
  const value = isInitial ? INITIAL_INSTALLER_RATING : Number(average_rating) || 0;
  return {
    value,
    formatted: formatStarRating(value),
    isInitial,
    reviewCount,
    reviewsLabel: `${reviewCount} ${reviewCount === 1 ? 'avaliação' : 'avaliações'}`,
  };
}

export function starFillPercent(value, index) {
  return Math.max(0, Math.min(1, (Number(value) || 0) - index)) * 100;
}
