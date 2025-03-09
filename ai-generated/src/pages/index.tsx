import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
// import { auth } from "@/lib/firebase"
import { useRouter } from "next/router"
import Head from "next/head"

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // useEffect(() => {
  //   const unsubscribe = auth.onAuthStateChanged((user) => {
  //     setUser(user)
  //     setLoading(false)
  //   })

  //   return () => unsubscribe()
  // }, [])

  return (
    <>
      <Head>
        <title>Peppa - AI Operated Emulated Environments</title>
        <meta name="description" content="Let AI agents operate emulated x86 environments with GUI & CLI capabilities" />
      </Head>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="mr-4 flex">
              <Link href="/" className="mr-10 flex items-center space-x-2">
                <span className="font-bold text-xl inline-block">🐷 Peppa</span>
              </Link>
            </div>
            <div className="flex flex-1 items-center justify-end space-x-2">
              {!loading && (
                <>
                  {user ? (
                    <Button onClick={() => router.push('/dashboard')}>Dashboard</Button>
                  ) : (
                    <Button onClick={() => router.push('/auth')}>Sign In</Button>
                  )}
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1">
          <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
            <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
              <h1 className="font-bold text-3xl sm:text-5xl md:text-6xl lg:text-7xl">
                AI Agents in Emulated Environments
              </h1>
              <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                Peppa lets AI agents operate emulated x86 GUI & CLI machines. Create isolated environments for agents to complete tasks with real operating systems.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {!loading && (
                  <>
                    {user ? (
                      <Button size="lg" onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                    ) : (
                      <Button size="lg" onClick={() => router.push('/auth')}>Get Started</Button>
                    )}
                  </>
                )}
                <Button variant="outline" size="lg" asChild>
                  <Link href="/docs">
                    Documentation
                  </Link>
                </Button>
              </div>
            </div>
          </section>
          <section className="container space-y-6 py-8 md:py-12 lg:py-24">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
              <h2 className="font-bold text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
                Features
              </h2>
              <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                Everything you need to let AI agents interact with real operating systems.
              </p>
            </div>
            <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
              <div className="relative overflow-hidden rounded-lg border bg-background p-2">
                <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                  <div className="space-y-2">
                    <h3 className="font-bold">Multiple AI Models</h3>
                    <p className="text-sm text-muted-foreground">
                      Support for DeepSeek, Gemini, and more AI agents to operate in emulated environments.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg border bg-background p-2">
                <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                  <div className="space-y-2">
                    <h3 className="font-bold">x86 Emulation</h3>
                    <p className="text-sm text-muted-foreground">
                      Uses copy.sh/v86 to provide realistic operating system environments with GUI and CLI.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg border bg-background p-2">
                <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                  <div className="space-y-2">
                    <h3 className="font-bold">YAML Configuration</h3>
                    <p className="text-sm text-muted-foreground">
                      Define tasks and environments using simple .peppa YAML files.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg border bg-background p-2">
                <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                  <div className="space-y-2">
                    <h3 className="font-bold">Real-time Interaction</h3>
                    <p className="text-sm text-muted-foreground">
                      Watch AI operate in real-time and interact through a web interface.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg border bg-background p-2">
                <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                  <div className="space-y-2">
                    <h3 className="font-bold">Orchestration</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage multiple environments with an easy-to-use orchestration layer.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg border bg-background p-2">
                <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                  <div className="space-y-2">
                    <h3 className="font-bold">Agent Feedback</h3>
                    <p className="text-sm text-muted-foreground">
                      See what the AI is thinking and doing in real-time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="w-full py-6 border-t">
          <div className="container flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Peppa. All rights reserved.
            </p>
            <div className="flex items-center space-x-4">
              <Link href="/terms" className="text-sm text-muted-foreground hover:underline">
                Terms
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:underline">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
} 