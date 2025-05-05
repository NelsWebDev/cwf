import { useContext } from "react"
import { GameServiceContext } from "../providers/GameServiceProvider"

export const useGame = () => {
    const ctx = useContext(GameServiceContext);
    if (!ctx) {
        throw new Error("useGame must be used within a GameServiceProvider");
    }
    return ctx;
}
export default useGame;