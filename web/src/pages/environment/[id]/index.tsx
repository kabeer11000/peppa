import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmulatorCheck } from '@/components/EmulatorCheck';
import { AIAgent, AIAgentMessage } from '@/lib/ai-agent';
import { V86Wrapper } from '@/lib/v86-wrapper';
import { getAvailableModels, getAvailableProviders } from '@/lib/ai-models';
import { db } from '@/lib/firebase';
import Head from 'next/head';

interface Environment {
  id: string;
  name: string;
  description: string;
  os: string;
  aiProvider: string;
  aiModel: string;
  userId: string;
  createdAt: Date;
}

export default function EnvironmentPage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [messages, setMessages] = useState<AIAgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [agentStatus, setAgentStatus] = useState<'idle' | 'starting' | 'running' | 'stopped'>('idle');
  
  const emulatorRef = useRef<V86Wrapper | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aiAgentRef = useRef<AIAgent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch environment data
  useEffect(() => {
    if (!id) return;

    const fetchEnvironment = async () => {
      try {
        setLoading(true);
        // Get environment from Firestore
        const docRef = db.collection('environments').doc(id as string);
        const doc = await docRef.get();

        if (!doc.exists) {
          setError('Environment not found');
          setLoading(false);
          return;
        }

        const data = doc.data() as Omit<Environment, 'id' | 'createdAt'> & { createdAt: { toDate: () => Date } };
        setEnvironment({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
        });
        setLoading(false);
      } catch (err) {
        console.error('Error fetching environment:', err);
        setError('Failed to load environment');
        setLoading(false);
      }
    };

    fetchEnvironment();
  }, [id]);

  // Initialize emulator and AI agent
  useEffect(() => {
    if (!environment || !containerRef.current || initialized) return;

    const initEmulator = async () => {
      try {
        // Create V86 instance
        const emulator = new V86Wrapper(environment.os);
        emulatorRef.current = emulator;

        // Initialize emulator - ensure containerRef.current is not null
        if (containerRef.current) {
          await emulator.init(containerRef.current);
        } else {
          throw new Error("Container reference is null");
        }

        // Create AI agent
        const agent = new AIAgent({
          provider: environment.aiProvider as any,
          model: environment.aiModel,
          task: `operating ${environment.os} environment`,
          systemPrompt: `You are a helpful AI assistant for the ${environment.name} environment, which is running ${environment.os}. 
          Description: ${environment.description}
          Your task is to help the user operate this environment, execute commands, and achieve their goals.
          You can see the screen of the virtual machine and can execute commands.
          Always be helpful, concise, and focus on the task at hand.`
        });

        // Connect agent to emulator
        agent.setEmulator(emulator);

        // Subscribe to agent updates
        agent.onUpdate((state) => {
          setMessages(state.history);
          setAgentStatus(state.isProcessing ? 'running' : 'idle');
        });

        aiAgentRef.current = agent;
        setInitialized(true);
      } catch (err) {
        console.error('Error initializing emulator:', err);
        setError('Failed to initialize emulator');
      }
    };

    initEmulator();

    // Cleanup function
    return () => {
      if (emulatorRef.current) {
        emulatorRef.current.destroy();
        emulatorRef.current = null;
      }
      if (aiAgentRef.current) {
        aiAgentRef.current.stop();
        aiAgentRef.current = null;
      }
    };
  }, [environment, initialized]);

  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartAgent = async () => {
    if (!aiAgentRef.current) return;
    
    setAgentStatus('starting');
    await aiAgentRef.current.start();
  };

  const handleStopAgent = () => {
    if (!aiAgentRef.current) return;
    
    aiAgentRef.current.stop();
    setAgentStatus('stopped');
  };

  const handleRestartEmulator = () => {
    if (!emulatorRef.current) return;
    
    emulatorRef.current.restart();
  };

  const handleSendMessage = async () => {
    if (!aiAgentRef.current || !input.trim()) return;

    const message = input.trim();
    setInput('');
    await aiAgentRef.current.sendUserMessage(message);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading environment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!environment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Environment not found</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{environment.name} - Peppa</title>
        <meta name="description" content={`AI environment: ${environment.description}`} />
      </Head>
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{environment.name}</h1>
            <p className="text-gray-500">{environment.description}</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>

        <EmulatorCheck />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Emulator ({environment.os})</span>
                  <Button variant="ghost" size="sm" onClick={handleRestartEmulator}>
                    Restart
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  ref={containerRef} 
                  className="relative bg-black w-full h-[400px] overflow-hidden"
                />
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>AI Agent ({environment.aiModel})</span>
                    <div 
                      className={`w-2 h-2 rounded-full ${
                        agentStatus === 'idle' ? 'bg-yellow-500' : 
                        agentStatus === 'running' ? 'bg-green-500' : 
                        agentStatus === 'starting' ? 'bg-blue-500' : 
                        'bg-red-500'
                      }`} 
                    />
                  </div>
                  {agentStatus === 'idle' || agentStatus === 'stopped' ? (
                    <Button variant="outline" size="sm" onClick={handleStartAgent}>Start</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleStopAgent}>Stop</Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow overflow-hidden flex flex-col">
                <div className="flex-grow overflow-y-auto mb-4 space-y-4">
                  {messages
                    .filter(msg => msg.role !== 'system')
                    .map((msg, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground ml-4'
                            : 'bg-muted text-foreground mr-4'
                        }`}
                      >
                        <div className="text-xs opacity-70 mb-1">
                          {msg.role === 'user' ? 'You' : 'AI'}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Ask the AI agent..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={agentStatus !== 'idle' && agentStatus !== 'running'}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={agentStatus !== 'idle' && agentStatus !== 'running'}
                  >
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
} 