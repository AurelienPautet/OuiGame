import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts";

/**
 * Route guard for the admin dashboard. While the session is still verifying we
 * hold on a minimal centered spinner; once resolved, anyone who is not a
 * logged-in admin is bounced back to the home hub. Admins fall through to the
 * wrapped page.
 */
export const ProtectedAdminRoute = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="size-10 rounded-full border-4 border-ink/30 border-t-ink animate-spin" />
      </div>
    );
  }

  if (!user || user.isAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
