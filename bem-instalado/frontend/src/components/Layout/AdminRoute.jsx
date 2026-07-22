import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasAdminAccess } from '../../utils/adminAccess';

export default function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!hasAdminAccess(user)) {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}
