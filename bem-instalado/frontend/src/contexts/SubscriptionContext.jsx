import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const FREE_ACCESS = {
  plan: 'free',
  plan_label: 'InstalarPro Grátis',
  is_pro: false,
  can_use_app: true,
  can_use_premium: false,
  access_mode: 'free',
  limits: {
    monthly_interests: 5,
    clients: 15,
    monthly_budgets: 5,
    environments_per_budget: 1,
    portfolio_photos: 3,
    availability_slots: 3,
  },
  usage: {
    monthly_interests: 0,
    clients: 0,
    monthly_budgets: 0,
    portfolio_photos: 0,
    availability_slots: 0,
  },
  remaining: {
    monthly_interests: 5,
    clients: 15,
    monthly_budgets: 5,
    environments_per_budget: 1,
    portfolio_photos: 3,
    availability_slots: 3,
  },
  features: {
    advanced_dashboard: false,
    advanced_reviews: false,
    multi_environment_budgets: false,
    installment_budgets: true,
    custom_pdf_branding: false,
    custom_accent: false,
    compact_density: false,
  },
};

const SubscriptionContext = createContext({
  subscription: null,
  planAccess: FREE_ACCESS,
  isPro: false,
  loading: false,
  refreshSubscription: async () => null,
});

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const isInstaller = user?.account_type === 'installer' || user?.is_admin;
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshSubscription = useCallback(async () => {
    if (!isInstaller) {
      setSubscription(null);
      return null;
    }

    try {
      setLoading(true);
      const response = await api.get('/subscriptions');
      setSubscription(response.data);
      return response.data;
    } catch (_error) {
      return null;
    } finally {
      setLoading(false);
    }
  }, [isInstaller]);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const planAccess = subscription?.plan_access || {
    ...FREE_ACCESS,
    plan: subscription?.plan || FREE_ACCESS.plan,
  };

  const value = useMemo(() => ({
    subscription,
    planAccess,
    isPro: Boolean(planAccess.is_pro),
    loading,
    refreshSubscription,
  }), [loading, planAccess, refreshSubscription, subscription]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export { FREE_ACCESS };
