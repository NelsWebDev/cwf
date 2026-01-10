import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../AppLayout";
import { DecksList } from "../pages/DecksList";
import EditDeck from "../pages/EditDeck";
import LoginPage from "../providers/auth/LoginPage";
import HomePage from "./HomePage";
import RequireAuth from "./RequireAuth";


export default function AppRoutes() {
    return (
        <Routes>
            {/* PUBLIC */}
            <Route path="/login" element={<LoginPage />} />

            {/* PROTECTED */}
            <Route
                path="/"
                element={
                    <RequireAuth>
                        <AppLayout />
                    </RequireAuth>
                }
            >
                <Route path="/decks" index element={
                    <RequireAuth>
                        <DecksList />
                    </RequireAuth>
                } />
                <Route path="/decks/:deckId" element={
                    <RequireAuth>
                        <EditDeck />
                    </RequireAuth>
                } />
                <Route index element={<HomePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
