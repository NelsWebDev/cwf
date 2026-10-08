import { ReactElement, useState } from "react";
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
        setTitle(title ? title : "Server Message");
        if("message" in props) {
            setMessage(props.message);
        }
        if("element" in props) {
            setElement(props.element);
        }
        setIsModalOpen(true);
        if(autoclose) {
            setTimeout(() => {
                setIsModalOpen(false);
            }, autoclose);
        }
        if("canClose"  in props && props.canClose === false){
            setCanClose(false);
        }
    }

    const closeModal = () => {
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