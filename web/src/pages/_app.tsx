import type { AppProps } from 'next/app'
// import { Inter } from 'next/font/google'
import '@/styles/global.css';
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider';
import Head from 'next/head';
// import Script from 'next/script';

// const inter = Inter({ subsets: ['latin'] })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <script src="/v86/libv86.js" />
      </Head>
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
    </>
  )
} 