import { useContext } from "react"
import { ModalServiceContext } from "../providers/ModalServiceProvider";

export const useModal = () => {
    const ctx = useContext(ModalServiceContext);
    if(!ctx) {
        throw new Error("useModal must be used within a ModalServiceProvider");
    }
    return ctx;
}
export default useModal;