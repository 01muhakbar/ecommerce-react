import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

type RequireAdminProps = {
  allowedRoles?: string[]; // default: ['Admin','Super Admin']
};

export default function RequireAdmin({ allowedRoles = ['Admin','Super Admin'] }: RequireAdminProps) {
  const user = useAuthStore(s => s.user);
  const userRole = (user?.role ?? '').toLowerCase();
  const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

  console.debug('RequireAdmin user snapshot:', user);

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  if (!normalizedAllowed.includes(userRole)) {
    console.warn(`Redirecting to login. User role: '${user?.role}' is not in allowed roles:`, allowedRoles);
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}