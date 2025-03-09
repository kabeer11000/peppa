import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmulatorCheck } from '@/components/EmulatorCheck';
import { AIAgent, AIAgentMessage } from '@/lib/ai-agent';
import { V86Wrapper, V86WrapperState } from '@/lib/v86-wrapper';
import { getAvailableModels, getAvailableProviders, AIProvider } from '@/lib/ai-models';
import { db } from '@/lib/firebase';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, Terminal, Send, StopCircle, PlayCircle, RefreshCw, Cpu, Network, HardDrive } from 'lucide-react';
import Head from 'next/head';

interface Environment { 
  id: string;
  name: string;
  description: string;
  os: string;
  aiProvider: AIProvider;
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
  const [containerMounted, setContainerMounted] = useState(false);
  const [emulatorState, setEmulatorState] = useState<V86WrapperState | null>(null);
  
  const emulatorRef = useRef<V86Wrapper | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aiAgentRef = useRef<AIAgent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Handle container mounting
  useEffect(() => {
    if (containerRef.current) {
      setContainerMounted(true);
    }
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch environment data
  useEffect(() => {
    if (!id) return;

    const fetchEnvironment = async () => {
      try {
        setLoading(true);
        const docRef = db.collection('environments').doc(id as string);
        const doc = await docRef.get();

        if (!doc.exists) {
          setError('Environment not found');
          setLoading(false);
          return;
        }

        const data = doc.data() as Omit<Environment, 'id' | 'createdAt'> & { createdAt: { toDate: () => Date } };
        
        // Validate required fields
        if (!data.aiProvider || !['deepseek', 'openai', 'anthropic', 'gemini'].includes(data.aiProvider)) {
          setError('Environment has invalid AI provider configuration');
          setLoading(false);
          return;
        }

        if (!data.aiModel) {
          setError('Environment is missing AI model configuration');
          setLoading(false);
          return;
        }

        // Set environment with validated data
        setEnvironment({
          id: doc.id,
          name: data.name || 'Unnamed Environment',
          description: data.description || '',
          os: data.os || 'linux',
          aiProvider: data.aiProvider as AIProvider,
          aiModel: data.aiModel,
          userId: data.userId,
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
    if (!environment || !containerRef.current || initialized || !containerMounted) return;

    const initEmulator = async () => {
      try {
        // Validate AI provider
        const providers = getAvailableProviders();
        if (!environment.aiProvider || !providers.some(p => p.id === environment.aiProvider)) {
          throw new Error(`Invalid AI provider: ${environment.aiProvider}`);
        }

        // Create V86 instance
        const emulator = new V86Wrapper(environment.os);
        emulatorRef.current = emulator;

        // Subscribe to emulator state updates
        emulator.onUpdate((state) => {
          setEmulatorState(state);
        });

        // Initialize emulator with container
        if (!containerRef.current) {
          throw new Error("Container reference is null");
        }

        // Wait for container to be ready and in DOM
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!document.body.contains(containerRef.current)) {
          throw new Error("Container is not in the DOM");
        }

        await emulator.init(containerRef.current);

        // Create AI agent
        const agent = new AIAgent({
          provider: environment.aiProvider,
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
          setAgentStatus(state.status);
        });

        aiAgentRef.current = agent;
        setInitialized(true);

        // Start the agent
        await agent.start();
      } catch (err) {
        console.error('Error initializing emulator:', err);
        setError('Failed to initialize emulator');
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to initialize emulator. Please check if all required files are present.",
        });
      }
    };

    initEmulator();

    // Cleanup function
    return () => {
      try {
        if (aiAgentRef.current) {
          aiAgentRef.current.stop();
          aiAgentRef.current = null;
        }
        if (emulatorRef.current) {
          emulatorRef.current.destroy();
          emulatorRef.current = null;
        }
        setInitialized(false);
      } catch (error) {
        console.error('Error cleaning up:', error);
      }
    };
  }, [environment, initialized, toast, containerMounted]);

  // Load V86 script
  useEffect(() => {
    const loadV86Script = async () => {
      const script = document.createElement('script');
      script.src = '/v86/libv86.js';
      script.async = true;
      
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });

      document.head.appendChild(script);
      
      try {
        await loadPromise;
        console.log('V86 script loaded successfully');
      } catch (error) {
        console.error('Failed to load V86 script:', error);
        setError('Failed to load emulator script');
      }
    };

    loadV86Script();
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || !aiAgentRef.current || agentStatus !== 'running') return;

    const message = input.trim();
    setInput('');
    await aiAgentRef.current.sendUserMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRestartEmulator = async () => {
    if (emulatorRef.current) {
      emulatorRef.current.restart();
      toast({
        title: "Emulator restarted",
        description: "The emulator has been restarted successfully.",
      });
    }
  };

  const handleToggleAgent = async () => {
    if (!aiAgentRef.current) return;

    if (agentStatus === 'running') {
      aiAgentRef.current.stop();
      toast({
        title: "Agent stopped",
        description: "The AI agent has been stopped.",
      });
    } else {
      await aiAgentRef.current.start();
      toast({
        title: "Agent started",
        description: "The AI agent has been started.",
      });
    }
  };

  // Render status panel with improved UI
  const renderStatusPanel = () => {
    if (!emulatorState) return null;

    const getStatusColor = () => {
      switch (emulatorState.status) {
        case 'ready':
          return 'text-green-500';
        case 'stopped':
          return 'text-red-500';
        case 'initializing':
        case 'loading v86':
        case 'downloading system files':
          return 'text-yellow-500';
        default:
          return 'text-gray-500';
      }
    };

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
              <span className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Status
              </span>
              <span className={`font-mono font-bold ${getStatusColor()}`}>
                {emulatorState.status}
              </span>
            </div>

            {emulatorState.bootProgress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Boot Progress</span>
                  <span>{emulatorState.bootProgress}%</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${emulatorState.bootProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-2 bg-secondary/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Memory</div>
                <div className="font-mono font-bold">
                  {(emulatorState.memoryUsage / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>

              <div className="p-2 bg-secondary/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Network</div>
                <div className="font-mono font-bold">
                  {emulatorState.networkActive ? (
                    <span className="text-green-500">Active</span>
                  ) : (
                    <span className="text-gray-500">Inactive</span>
                  )}
                </div>
              </div>
            </div>

            {emulatorState.lastAction && (
              <div className="p-2 bg-secondary/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Last Action</div>
                <div className="font-mono text-sm break-words">
                  {emulatorState.lastAction}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading environment...</p>
      </div>
    );
  }

  if (error || !environment) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'Environment not found'}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Head>
        <title>{environment.name} - Environment</title>
      </Head>

      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>
              Back
            </Button>
            <h1 className="font-bold text-xl">{environment.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestartEmulator}
              className="flex items-center gap-2"
              disabled={!emulatorState?.isRunning}
            >
              <RefreshCw className="h-4 w-4" />
              Restart
            </Button>
            <Button
              variant={agentStatus === 'running' ? "destructive" : "secondary"}
              size="sm"
              onClick={handleToggleAgent}
              className="flex items-center gap-2"
              disabled={!emulatorState?.isRunning}
            >
              {agentStatus === 'running' ? (
                <>
                  <StopCircle className="h-4 w-4" />
                  Stop Agent
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Start Agent
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <EmulatorCheck />
            <Card>
              <CardContent className="p-4">
                <div 
                  ref={containerRef} 
                  className="w-full aspect-video bg-black rounded-lg overflow-hidden relative"
                >
                  {!emulatorState?.isRunning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                        <p className="text-white text-sm">{emulatorState?.status || 'Initializing...'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            {renderStatusPanel()}
            
            <Card>
              <CardHeader>
                <CardTitle>Chat</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                          msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="flex gap-2 mt-4">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    disabled={!emulatorState?.isRunning || agentStatus !== 'running'}
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={!emulatorState?.isRunning || agentStatus !== 'running'}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
} 