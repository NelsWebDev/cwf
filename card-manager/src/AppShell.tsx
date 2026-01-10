// AppShell.tsx (or AppProviders.tsx)
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Outlet } from "react-router-dom";

export function AppShell() {
    return (
        <MantineProvider>
            <ModalsProvider>
                <Outlet />
            </ModalsProvider>
        </MantineProvider>
    );
}
