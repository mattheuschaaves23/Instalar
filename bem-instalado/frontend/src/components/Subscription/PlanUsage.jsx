import { Link } from 'react-router';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { planLinkLabel } from '../../utils/storePlanCopy';

const LABELS = {
  monthly_interests: 'Interesses neste mês',
  clients: 'Clientes cadastrados',
  monthly_budgets: 'Orçamentos neste mês',
  portfolio_photos: 'Fotos no portfólio',
  availability_slots: 'Horários futuros',
};

export default function PlanUsage({ usageKey, compact = false, className = '' }) {
  const { isPro, planAccess } = useSubscription();
  if (isPro) return null;

  const limit = planAccess.limits?.[usageKey];
  const used = Number(planAccess.usage?.[usageKey] || 0);
  if (limit === null || limit === undefined) return null;

  const percent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const reached = used >= limit;

  return (
    <div className={`plan-usage rounded-[22px] border border-[var(--line)] bg-[var(--surface-soft)] ${compact ? 'p-4' : 'p-5'} ${className}`}>
      <div className="plan-usage-head flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="plan-usage-label text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-strong)]">
            {LABELS[usageKey] || 'Uso do plano Grátis'}
          </p>
          <p className="plan-usage-copy mt-1 text-sm text-[var(--muted)]">
            <strong>{used} de {limit}</strong> usados
            {reached ? ' • limite atingido' : ''}
          </p>
        </div>
        <Link className="ghost-button !min-h-0 !px-4 !py-2 text-xs" to="/subscription">
          {planLinkLabel('Conhecer o Pro')}
        </Link>
      </div>
      <div className="plan-usage-track mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
        <span
          className="plan-usage-progress block h-full rounded-full bg-[var(--gold-strong)] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ProFeatureNotice({ children, title = 'Recurso do plano Pro', className = '' }) {
  return (
    <div className={`pro-feature-notice rounded-[22px] border border-[var(--line)] bg-[var(--surface-soft)] p-5 ${className}`}>
      <p className="eyebrow">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{children}</p>
      <Link className="ghost-button mt-4 w-full sm:w-auto" to="/subscription">
        {planLinkLabel('Ver plano Pro')}
      </Link>
    </div>
  );
}
