import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button,  Container, Paper, PasswordInput, Text, TextInput, Title } from "@mantine/core";




const LoginPage = () => {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const { login, errorMessage,  isAuthenticated, disconnected, reconnect} = useAuth();

  if (localStorage.getItem('authToken') && !isAuthenticated && !errorMessage) {
    return <h4>Loading....</h4>
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" style={{
        fontFamily: 'Greycliff CF, sans-serif var(--mantine-font-family)',
        fontWeight: 900,
        color: 'light-dark(black, var(--mantine-color-white))',
      }}>
        Welcome Back Bitches!
      </Title>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md" styles={{
        root: {
          backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-3))',
        }
      }}>
        {errorMessage && (
          <Text size="sm" mb="md" 
          style={{ textAlign: 'center', color: 'light-dark(var(--mantine-color-red-8), var(--mantine-color-red-3))' }}>
            {errorMessage !== "invalid" && errorMessage}
            {errorMessage == "invalid" && (<iframe src="https://youtube.com/embed/ukznXQ3MgN0?autoplay=1&start=12&mute=0" 
              style={{ width: '226px', height: '400px', border: 'none', marginTop: '10px' }}
              title="Error Video"
            ></iframe>)}
          </Text>)}
        {(!disconnected || errorMessage === "You are logged out") && (<><TextInput label="Name"
          styles={{ label: { color: 'light-dark(var(--mantine-color-dark-9), var(--mantine-color-white))' } }}
          placeholder="Your Name" required onChange={e => setUsernameInput(e.currentTarget.value)} value={usernameInput} />
        <PasswordInput label="Password" placeholder="Game password" required mt="md"
          styles={{ label: { color: 'light-dark(var(--mantine-color-dark-9), var(--mantine-color-white))' } }}
          onChange={e => setPasswordInput(e.currentTarget.value)} value={passwordInput} />
          
        <Button fullWidth mt="xl" onClick={() => login(usernameInput, passwordInput)}>
          Sign in
        </Button></>)}
        {disconnected && errorMessage != "You are logged out" && (
          <Button fullWidth mt="xl" onClick={() => reconnect()}>Rejoin</Button>
        )}
      </Paper>
    </Container>


  )

}

export default LoginPage;