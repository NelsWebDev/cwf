import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { createTheme, MantineProvider } from '@mantine/core'
import AuthServiceProvider from './providers/auth/AuthServiceProvider.tsx'
import "@mantine/core/styles.css"
import GameServiceProvider from './providers/GameServiceProvider.tsx'
import ModalServiceProvider from './providers/ModalServiceProvider.tsx'


const theme = createTheme({
  fontFamily: 'Roboto, sans-serif',
  fontFamilyMonospace: 'Roboto Mono, monospace',
  headings: { fontFamily: 'Roboto, sans-serif' },
  components: {
    Button: {
      styles: {
        root: {
            backgroundColor: "light-dark(var(--mantine-color-blue-6), var(--mantine-color-blue-9))",
        }
      }
    },
    Card: {
      styles: {
        root: {
          color: "light-dark(var(--mantine-color-black), var(--mantine-color-white))"
        }
      }
    },
    Modal: {
      styles: {
        root: {
          body: {
            backgroundColor: "light-dark(white, var(--mantine-color-dark-3)",
            color: "light-dark(black, white)"
          },
          header: {
            backgroundColor: "light-dark(white, var(--mantine-color-dark-3)",
            color: "light-dark(black, white)",
          },
          title: {
            fontSize: "4.5rem",
            color: "light-dark(black, white)",
          }
        }
      }
    },
    Title: {
      styles: {
        color: "light-dark(black, var(--mantine-color-white))",
      }
    }, 
    Text: {
      styles: {
        root: {
          color: "light-dark(black, var(--mantine-color-white))",
        }
      }
    },
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme='auto' >
      <AuthServiceProvider>
      <ModalServiceProvider>
        <GameServiceProvider>
          <App />
        </GameServiceProvider>
      </ModalServiceProvider>
      </AuthServiceProvider>
    </MantineProvider>
  </StrictMode>,
)
