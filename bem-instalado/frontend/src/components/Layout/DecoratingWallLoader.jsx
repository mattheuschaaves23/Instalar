import './LoadingPlaceholder.css';

// Keep the existing export so route guards and lazy pages share the same
// lightweight pending state without changing their access checks.
export default function DecoratingWallLoader({
  embedded = false,
  phrase = 'Carregando conteúdo…',
}) {
  return (
    <div aria-busy="true" aria-label={phrase} className={`loading-placeholder${embedded ? ' loading-placeholder--embedded' : ''}`} role="status">
      <span className="sr-only">{phrase}</span>
      <div aria-hidden="true" className="loading-placeholder-lines">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
