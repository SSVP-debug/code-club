import { useAuth } from "../hooks/useAuth";
import { useGuest } from "../hooks/useGuest";
import { Navigate, useLocation } from "react-router-dom";
import { buildLoginRedirect } from "../utils/authRedirect";

function ProtectedRoute({ children, guestPortal = null }) {
  const { user, loading } = useAuth();
  const { isGuest, guestPortal: activeGuestPortal } = useGuest();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--border-strong)] border-t-[var(--theme-primary,#2dd4bf)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (guestPortal && isGuest && activeGuestPortal === guestPortal) {
      return children;
    }

    return <Navigate to={buildLoginRedirect(location.pathname + location.search)} replace />;
  }

  // Authentication is the only generic route-level guard. The daily
  // check-in is intentionally scoped to the student Dashboard route so
  // it never blocks Problems, Profile, Club, recruiter, TPO or admin pages.
  return children;
}

export default ProtectedRoute;
