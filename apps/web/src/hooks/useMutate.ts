import type { OperationVariables, TypedDocumentNode } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";
import { useModal } from "./useModal";
import { getErrorMessage } from "../utils";

/**
 * Returns a function that runs a GraphQL mutation and shows any error in the server message modal.
 * Resolves with the mutation data, or undefined if it failed.
 */
export const useMutate = () => {
    const client = useApolloClient();
    const { showModal } = useModal();

    return async <TData, TVariables extends OperationVariables>(
        mutation: TypedDocumentNode<TData, TVariables>,
        variables?: TVariables,
        errorTitle = "Whoops!",
    ): Promise<TData | undefined> => {
        try {
            const { data } = await client.mutate({ mutation, variables } as Parameters<typeof client.mutate<TData, TVariables>>[0]);
            return data ?? undefined;
        } catch (error) {
            showModal({ title: errorTitle, message: getErrorMessage(error) });
            return undefined;
        }
    };
};

export default useMutate;
