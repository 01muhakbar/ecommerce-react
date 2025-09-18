import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";

export default function RequireAdmin() {
  const location = useLocation();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  // This guard is now simpler because the check is explicit.
  // If not logged in, redirect to the login page.
  // We pass the current location so the user can be redirected back after login.
  if (!isLoggedIn) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // If logged in, render the child routes.
  return <Outlet />;
}
