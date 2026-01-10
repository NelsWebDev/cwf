import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RequireAuth({ children }: { children: ReactNode }) {
    const { isAuthenticated, isAuthenticating } = useAuth();
    const location = useLocation();

    console.log("RequireAuth:", { isAuthenticated, isAuthenticating, path: location.pathname });

    if (isAuthenticating) return null;

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <>{children}</>;
}
