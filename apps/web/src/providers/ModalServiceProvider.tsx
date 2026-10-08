import { ReactElement, useRef, useState } from "react";
import { ModalService,  ShowModalProps } from "../types";
import { Modal, Text } from "@mantine/core";
import { useSubscription } from "@apollo/client/react";
import { CLOSE_MODAL_SUBSCRIPTION } from "../graphql/operations";
import { ModalServiceContext } from "./Contexts";


const ModalServiceProvider = ({children} : {children: React.ReactNode}) => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState<string|ReactElement>("");
    const [canClose, setCanClose] = useState(true);
    const autoCloseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [element, setElement] = useState<ReactElement|undefined>(undefined);


    useSubscription(CLOSE_MODAL_SUBSCRIPTION, {
        fetchPolicy: "no-cache",
        onData: () => {
            setIsModalOpen(false);
            setCanClose(true);
        },
    });

    const showModal = (props: ShowModalProps ) => {
        const {title, autoclose} = props;
        if (autoCloseTimer.current) {
            clearTimeout(autoCloseTimer.current);
            autoCloseTimer.current = undefined;
        }
        setTitle(title ? title : "Server Message");
        setMessage("message" in props ? props.message : "");
        setElement("element" in props ? props.element : undefined);
        setCanClose(!("canClose" in props && props.canClose === false));
        setIsModalOpen(true);
        if(autoclose) {
            autoCloseTimer.current = setTimeout(() => {
                autoCloseTimer.current = undefined;
                setIsModalOpen(false);
            }, autoclose);
        }
    }

    const closeModal = () => {
        if (autoCloseTimer.current) {
            clearTimeout(autoCloseTimer.current);
            autoCloseTimer.current = undefined;
        }
        setIsModalOpen(false);
    }

    const value : ModalService = {
        isModalOpen,
        showModal,
        closeModal,
        
    }

    return (
        <ModalServiceContext.Provider value={value}>
            {children}
            {isModalOpen && (
                <Modal
                    opened={isModalOpen}
                    onClose={closeModal}
                    title={title}
                    styles={{
                        title: {
                            fontSize: "1.2rem",
                        }
                    }}
                    centered
                    withCloseButton={canClose}
                    closeOnClickOutside={canClose}
                >
                    <Text>{message}</Text>  
                    {element ? element : null}
                </Modal>
            )}
        </ModalServiceContext.Provider>
    )
}

export default ModalServiceProvider;