import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { DecksList } from "./pages/DecksList";
import { EditDeck } from "./pages/EditDeck";

export const Routes = createBrowserRouter([
    {
        path: "/manage",
        element: <AppShell />,
        children: [
            { index: true, element: <DecksList /> },
            { path: "decks/:deckId", element: <EditDeck /> },
        ],
    },
]);
