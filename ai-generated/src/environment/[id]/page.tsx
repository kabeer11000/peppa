"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { V86Wrapper } from "@/lib/v86-wrapper"
import { AIAgent, AIAgentState } from "@/lib/ai-agent"

interface Environment {
  id: string
  name: string
  os: string
  aiModel: string
  task: string
  userId: string
  createdAt: any
}

export default function EnvironmentPage({ params }: { params: { id: string } }) {
  const [environment, setEnvironment] = useState<Environment | null>(null)
  const [loading, setLoading] = useState(true)
  const [userMessage, setUserMessage] = useState("")
  const [agentState, setAgentState] = useState<AIAgentState | null>(null)
  const [emulatorReady, setEmulatorReady] = useState(false)
  
  const emulatorRef = useRef<HTMLDivElement>(null)
  const emulatorInstance = useRef<V86Wrapper | null>(null)
  const agentInstance = useRef<AIAgent | null>(null)
  
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/auth')
      } else {
        fetchEnvironment(params.id)
      }
    })

    return () => {
      unsubscribe()
      // Clean up emulator and agent when component unmounts
      if (emulatorInstance.current) {
        emulatorInstance.current.destroy()
      }
      if (agentInstance.current) {
        agentInstance.current.stop()
      }
    }
  }, [params.id, router])

  const fetchEnvironment = async (id: string) => {
    try {
      const docRef = doc(db, "environments", id)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<Environment, "id">
        setEnvironment({ id, ...data })
        
        // Initialize emulator and agent after fetching environment
        initializeEmulatorAndAgent(data.os, data.aiModel, data.task)
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Environment not found.",
        })
        router.push('/dashboard')
      }
      
      setLoading(false)
    } catch (error) {
      console.error("Error fetching environment:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load environment.",
      })
      setLoading(false)
    }
  }

  const initializeEmulatorAndAgent = async (os: string, aiModel: string, task: string) => {
    if (!emulatorRef.current) return
    
    try {
      // Initialize emulator
      const emulator = new V86Wrapper(os)
      await emulator.init(emulatorRef.current)
      emulatorInstance.current = emulator
      setEmulatorReady(true)
      
      // Initialize AI agent
      const agent = new AIAgent({
        model: aiModel as any,
        task,
      })
      agent.setEmulator(emulator)
      
      // Subscribe to agent updates
      agent.onUpdate((state) => {
        setAgentState(state)
      })
      
      agentInstance.current = agent
      
      // Start the agent
      setTimeout(() => {
        agent.start()
      }, 2000) // Give the emulator a moment to initialize
      
    } catch (error) {
      console.error("Error initializing emulator and agent:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initialize emulator.",
      })
    }
  }

  const handleSendMessage = () => {
    if (!userMessage.trim() || !agentInstance.current) return
    
    agentInstance.current.sendUserMessage(userMessage)
    setUserMessage("")
  }

  const handleRestartEmulator = () => {
    if (emulatorInstance.current) {
      emulatorInstance.current.restart()
      toast({
        title: "Emulator restarted",
        description: "The emulator has been restarted.",
      })
    }
  }

  const handleStopAgent = () => {
    if (agentInstance.current) {
      agentInstance.current.stop()
      toast({
        title: "Agent stopped",
        description: "The AI agent has been stopped.",
      })
    }
  }

  const handleStartAgent = () => {
    if (agentInstance.current) {
      agentInstance.current.start()
      toast({
        title: "Agent started",
        description: "The AI agent has been started.",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading environment...</p>
      </div>
    )
  }

  if (!environment) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Environment not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mr-2">
              Back
            </Button>
            <h1 className="font-bold text-xl">{environment.name}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleRestartEmulator}>
              Restart Emulator
            </Button>
            {agentState?.isProcessing ? (
              <Button variant="outline" size="sm" onClick={handleStopAgent}>
                Stop Agent
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleStartAgent}>
                Start Agent
              </Button>
            )}
          </div>
        </div>
      </header>
      
      <div className="flex-1 container py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          <Card className="h-full">
            <CardContent className="p-4 h-full">
              <div className="h-full flex flex-col">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Emulator</h2>
                  <p className="text-sm text-muted-foreground">
                    {environment.os.charAt(0).toUpperCase() + environment.os.slice(1)} • {environment.aiModel.charAt(0).toUpperCase() + environment.aiModel.slice(1)}
                  </p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div 
                    ref={emulatorRef} 
                    className="w-full h-full flex items-center justify-center border rounded-md"
                  >
                    {!emulatorReady && <p>Initializing emulator...</p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="h-full">
            <CardContent className="p-4 h-full">
              <div className="h-full flex flex-col">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">AI Agent</h2>
                  <p className="text-sm text-muted-foreground">
                    Task: {environment.task}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto mb-4">
                  {agentState?.history.map((message, index) => (
                    <div key={index} className={`mb-4 ${message.role === 'assistant' ? 'ml-4' : message.role === 'user' ? 'mr-4' : ''}`}>
                      <div className={`p-3 rounded-lg ${
                        message.role === 'assistant' 
                          ? 'bg-primary/10 text-primary-foreground/90' 
                          : message.role === 'user' 
                            ? 'bg-secondary text-secondary-foreground' 
                            : 'bg-muted text-muted-foreground text-xs'
                      }`}>
                        {message.role === 'system' ? (
                          <span className="font-semibold">System: </span>
                        ) : message.role === 'user' ? (
                          <span className="font-semibold">You: </span>
                        ) : (
                          <span className="font-semibold">AI: </span>
                        )}
                        {message.content}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  
                  {agentState?.isProcessing && (
                    <div className="text-sm text-muted-foreground animate-pulse">
                      AI is thinking...
                    </div>
                  )}
                </div>
                <div className="mt-auto">
                  <div className="flex space-x-2">
                    <Input
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      placeholder="Send a message to the AI agent..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                    />
                    <Button onClick={handleSendMessage}>Send</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}