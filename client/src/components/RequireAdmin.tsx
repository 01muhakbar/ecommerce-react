import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";

export default function RequireAdmin() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const allowedRoles = ["Admin", "Super Admin"];

  // If not logged in, or if the user role is not allowed, redirect to login.
  // We pass the current location so the user can be redirected back after login.
  if (!user || !allowedRoles.includes(user.role)) {
    // For debugging purposes, you can log why the redirect is happening.
    if (user) {
      console.log(
        `Redirecting to login. User role: '${user.role}' is not in allowed roles:`,
        allowedRoles
      );
    }
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // If logged in, render the child routes.
  return <Outlet />;
}
