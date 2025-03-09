import { V86Wrapper } from "./v86-wrapper";
import { AIModel, AIProvider, Message as AIMessage, createAIModel } from "./ai-models";

export interface AIAgentOptions {
  provider: AIProvider;
  model: string;
  task: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIAgentState {
  isProcessing: boolean;
  lastOutput: string;
  lastScreenshot: string | null;
  history: AIAgentMessage[];
  status: 'idle' | 'starting' | 'running' | 'stopped';
}

export interface AIAgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "command" | "response" | "error" | "system";
  metadata?: {
    command?: string;
    screenshot?: string;
    error?: string;
  };
}

export class AIAgent {
  private provider: AIProvider;
  private modelName: string;
  private task: string;
  private systemPrompt: string;
  private maxTokens: number;
  private temperature: number;
  private emulator: V86Wrapper | null = null;
  private isProcessing: boolean = false;
  private status: AIAgentState['status'] = 'idle';
  private history: AIAgentMessage[] = [];
  private lastOutput: string = "";
  private onUpdateCallbacks: Array<(state: AIAgentState) => void> = [];
  private abortController: AbortController | null = null;
  private aiModel: AIModel;
  private commandQueue: string[] = [];
  private isExecutingCommand: boolean = false;

  constructor(options: AIAgentOptions) {
    this.provider = options.provider;
    this.modelName = options.model;
    this.task = options.task;
    this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
    this.maxTokens = options.maxTokens || 2048;
    this.temperature = options.temperature || 0.7;

    // Initialize AI model
    this.aiModel = createAIModel({
      provider: this.provider,
      model: this.modelName,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      systemPrompt: this.systemPrompt,
    });

    // Add system message to history
    this.addToHistory({
      role: "system",
      content: this.systemPrompt,
      timestamp: new Date(),
      type: "system"
    });
  }

  public setEmulator(emulator: V86Wrapper): void {
    this.emulator = emulator;
    
    // Set up emulator event listeners
    emulator.onUpdate((state) => {
      // Update AI state based on emulator changes
      this.notifyUpdate();
    });
  }

  private getDefaultSystemPrompt(): string {
    return `You are an AI assistant helping with a ${this.task} task in a virtual machine environment.
    You have access to a virtual machine running on the user's computer.
    You can see the screen output and execute commands.
    
    Guidelines:
    1. Be concise and focused on the task at hand
    2. When executing commands, use code blocks with \`\`\` for clear formatting
    3. Monitor command output and provide feedback
    4. If something goes wrong, explain the issue and suggest solutions
    5. Break down complex tasks into manageable steps
    
    Current task: ${this.task}`;
  }

  private addToHistory(message: AIAgentMessage): void {
    this.history.push(message);
    this.notifyUpdate();
  }

  public async start(): Promise<void> {
    if (this.status !== 'idle') return;

    this.status = 'starting';
    this.isProcessing = true;
    this.notifyUpdate();

    try {
      // Take initial screenshot
      const screenshot = await this.emulator?.takeScreenshot();
      
      // Add initial assistant message
      const initialResponse = `Hello! I'm your AI assistant for ${this.task}. I'm connected to your virtual machine and ready to help. What would you like to do?`;
      
      this.addToHistory({
        role: "assistant",
        content: initialResponse,
        timestamp: new Date(),
        type: "response",
        metadata: {
          screenshot: screenshot || undefined
        }
      });
      
      this.lastOutput = initialResponse;
      this.status = 'running';
    } catch (error) {
      console.error("Error starting AI agent:", error);
      this.status = 'idle';
      this.addToHistory({
        role: "system",
        content: `Error starting AI agent: ${error}`,
        timestamp: new Date(),
        type: "error",
        metadata: { error: String(error) }
      });
    } finally {
      this.isProcessing = false;
      this.notifyUpdate();
    }
  }

  public async sendUserMessage(message: string): Promise<void> {
    if (this.isProcessing || this.status !== 'running') return;

    this.addToHistory({
      role: "user",
      content: message,
      timestamp: new Date()
    });

    await this.processNextStep();
  }

  private async processNextStep(): Promise<void> {
    this.isProcessing = true;
    this.notifyUpdate();

    try {
      // Get latest screenshot
      const screenshot = await this.emulator?.takeScreenshot();

      // Get AI response
      const response = await this.getAIResponse();

      // Add response to history
      this.addToHistory({
        role: "assistant",
        content: response,
        timestamp: new Date(),
        type: "response",
        metadata: {
          screenshot: screenshot || undefined
        }
      });

      this.lastOutput = response;

      // Extract and queue commands
      const commands = this.extractCommands(response);
      if (commands.length > 0) {
        this.commandQueue.push(...commands);
        await this.processCommandQueue();
      }
    } catch (error) {
      console.error("Error in AI agent loop:", error);
      this.addToHistory({
        role: "system",
        content: `Error processing step: ${error}`,
        timestamp: new Date(),
        type: "error",
        metadata: { error: String(error) }
      });
    } finally {
      this.isProcessing = false;
      this.notifyUpdate();
    }
  }

  private extractCommands(response: string): string[] {
    const commands: string[] = [];
    const regex = /```(?:bash|shell)?\s*([\s\S]*?)```/g;
    let match;
    
    while ((match = regex.exec(response)) !== null) {
      if (match[1]?.trim()) {
        commands.push(match[1].trim());
      }
    }
    
    return commands;
  }

  private async processCommandQueue(): Promise<void> {
    if (this.isExecutingCommand || !this.emulator || this.commandQueue.length === 0) return;

    this.isExecutingCommand = true;

    try {
      while (this.commandQueue.length > 0) {
        const command = this.commandQueue.shift();
        if (!command) continue;

        // Add command to history
        this.addToHistory({
          role: "assistant",
          content: `Executing command:\n\`\`\`\n${command}\n\`\`\``,
          timestamp: new Date(),
          type: "command",
          metadata: { command }
        });

        // Execute command
        await this.emulator.sendText(command + "\n");
        
        // Wait for command to complete (you might want to implement proper command completion detection)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Take screenshot after command execution
        const screenshot = await this.emulator.takeScreenshot();
        if (screenshot) {
          this.notifyUpdate();
        }
      }
    } catch (error) {
      console.error("Error executing commands:", error);
      this.addToHistory({
        role: "system",
        content: `Error executing command: ${error}`,
        timestamp: new Date(),
        type: "error",
        metadata: { error: String(error) }
      });
    } finally {
      this.isExecutingCommand = false;
    }
  }

  private async getAIResponse(): Promise<string> {
    const context = this.history.map(msg => ({
      role: msg.role,
      content: msg.content
    })) as AIMessage[];

    this.abortController = new AbortController();

    try {
      const screenshot = this.emulator?.getScreenshot();
      if (screenshot) {
        context.push({
          role: "system",
          content: `[Current screen state: ${await this.analyzeScreenshot(screenshot)}]`
        });
      }

      return await this.aiModel.generateCompletion(context);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return "Request was cancelled.";
      }
      console.error("Error getting AI response:", error);
      return "I encountered an error processing your request. Please try again.";
    }
  }

  private async analyzeScreenshot(screenshot: string): Promise<string> {
    // In a real implementation, you might want to use OCR or image analysis
    // For now, we'll return a simple description
    return "The screen shows the virtual machine's display with a command interface.";
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    this.status = 'stopped';
    this.isProcessing = false;
    this.commandQueue = [];
    this.isExecutingCommand = false;
    
    this.addToHistory({
      role: "system",
      content: "AI agent stopped",
      timestamp: new Date(),
      type: "system"
    });
    
    this.notifyUpdate();
  }

  public getState(): AIAgentState {
    return {
      isProcessing: this.isProcessing,
      lastOutput: this.lastOutput,
      lastScreenshot: this.emulator?.getScreenshot() || null,
      history: [...this.history],
      status: this.status
    };
  }

  public onUpdate(callback: (state: AIAgentState) => void): () => void {
    this.onUpdateCallbacks.push(callback);
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyUpdate(): void {
    const state = this.getState();
    this.onUpdateCallbacks.forEach(callback => callback(state));
  }
} 