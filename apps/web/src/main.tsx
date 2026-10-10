import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ColorSchemeScript, createTheme, MantineProvider } from '@mantine/core'
import AuthServiceProvider from './providers/auth/AuthServiceProvider.tsx'
import "@mantine/core/styles.css"
import GameServiceProvider from './providers/GameServiceProvider.tsx'
import ModalServiceProvider from './providers/ModalServiceProvider.tsx'
import { ApolloProvider } from '@apollo/client/react'
import { apolloClient } from './graphql/client.ts'
import { BrowserRouter, Route, Routes } from 'react-router'
import DecksApp from './decks/DecksApp.tsx'
import { ThemeOption, ThemeOptionContext } from './providers/Contexts.tsx'

const themeOptionStorageKey = 'cwf-color-theme';

const getInitialThemeOption = (): ThemeOption => {
  const savedThemeOption = window.localStorage.getItem(themeOptionStorageKey);
  if (savedThemeOption === 'auto' || savedThemeOption === 'light' || savedThemeOption === 'dark' || savedThemeOption === 'purple') {
    return savedThemeOption;
  }
  const savedColorScheme = window.localStorage.getItem('mantine-color-scheme-value');
  if (savedColorScheme === 'light' || savedColorScheme === 'dark' || savedColorScheme === 'auto') {
    return savedColorScheme;
  }
  return 'auto';
};

export function Root() {
  const [themeOption, setThemeOption] = useState<ThemeOption>(getInitialThemeOption);
  const isPurpleTheme = themeOption === 'purple';

  const theme = createTheme({
    fontFamily: 'Roboto, sans-serif',
    fontFamilyMonospace: 'Roboto Mono, monospace',
    headings: { fontFamily: 'Roboto, sans-serif' },
    ...(isPurpleTheme && {
      colors: {
        blue: [
          '#f3e8ff',
          '#e9d5ff',
          '#d8b4fe',
          '#c084fc',
          '#a855f7',
          '#9333ea',
          '#7e22ce',
          '#6b21a8',
          '#581c87',
          '#3b0764',
        ],
        dark: [
          '#e9d5ff',
          '#d8b4fe',
          '#c4b5fd',
          '#a78bfa',
          '#8b5cf6',
          '#3f3550',
          '#30283f',
          '#251f32',
          '#1e1929',
          '#15121d',
        ],
      },
    }),
    components: {
      Button: {
        styles: {
          root: {
            backgroundColor: "light-dark(var(--mantine-color-blue-6), var(--mantine-color-blue-9))",
          },
        },
      },
      Card: {
        styles: {
          root: {
            color: "light-dark(var(--mantine-color-black), var(--mantine-color-white))",
          },
        },
      },
      Modal: {
        styles: {
          root: {
            body: {
              backgroundColor: "light-dark(white, var(--mantine-color-dark-3)",
              color: "light-dark(black, white)",
            },
            header: {
              backgroundColor: "light-dark(white, var(--mantine-color-dark-3)",
              color: "light-dark(black, white)",
            },
            title: {
              fontSize: "4.5rem",
              color: "light-dark(black, white)",
            },
          },
        },
      },
      Title: {
        styles: {
          color: "light-dark(black, var(--mantine-color-white))",
        },
      },
      Text: {
        styles: {
          root: {
            color: "light-dark(black, var(--mantine-color-white))",
          },
        },
      },
    },
  });

  return (
    <>
      <ColorSchemeScript defaultColorScheme='auto'/>
      <ThemeOptionContext.Provider value={{
        themeOption,
        setThemeOption: (option) => {
          window.localStorage.setItem(themeOptionStorageKey, option);
          setThemeOption(option);
        },
      }}>
        <MantineProvider
          theme={theme}
          defaultColorScheme='auto'
          forceColorScheme={isPurpleTheme ? 'dark' : undefined}
        >
          <BrowserRouter>
            <Routes>
              <Route path="/decks/*" element={<DecksApp />} />
              <Route
                path="*"
                element={
                  <ApolloProvider client={apolloClient}>
                    <AuthServiceProvider>
                      <ModalServiceProvider>
                        <GameServiceProvider>
                          <App />
                        </GameServiceProvider>
                      </ModalServiceProvider>
                    </AuthServiceProvider>
                  </ApolloProvider>
                }
              />
            </Routes>
          </BrowserRouter>
        </MantineProvider>
      </ThemeOptionContext.Provider>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
