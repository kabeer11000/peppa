import type { AppProps } from 'next/app'
// import { Inter } from 'next/font/google'
import '@/styles/global.css';
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'

// const inter = Inter({ subsets: ['latin'] })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <main>
        <Component {...pageProps} />
        <Toaster />
      </main>
    </ThemeProvider>
  )
} 