import { Container } from "@mantine/core";
import { Outlet } from "react-router-dom";
import { HeaderMenu } from "./components/Navbar";
import Scoreboard from "./components/Scoreboard";

export default function AppLayout() {
    return (
        <>
            <HeaderMenu />
            <Container fluid>
                <Outlet />
            </Container>
            <Scoreboard />
        </>
    );
}
