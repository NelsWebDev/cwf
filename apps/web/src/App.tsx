import { Container } from '@mantine/core';
import MyHand from './components/MyHand';
import { HeaderMenu } from './components/Navbar';
import RoundArea from './components/RoundArea';
import NotificationManager from './components/NotificationManager';
import Scoreboard from './components/Scoreboard';

function App() {
  return (
    <>
      <NotificationManager />
      <HeaderMenu />
      <Container fluid>
        <RoundArea />
        <MyHand />
      </Container>
      <Scoreboard />
    </>
  )
}

export default App
