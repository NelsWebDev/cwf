import { useContext } from "react"
import { AuthServiceContext } from "../providers/auth/AuthServiceProvider"

export const useAuth = () => {
    const ctx = useContext(AuthServiceContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthServiceProvider");
    }
    return ctx;
}
export default useAuth;