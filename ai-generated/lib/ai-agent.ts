import { V86Wrapper } from "./v86-wrapper";

export type AIModel = "deepseek" | "gemini" | "claude";

export interface AIAgentOptions {
  model: AIModel;
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
}

export interface AIAgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: Date;
}

export class AIAgent {
  private model: AIModel;
  private task: string;
  private systemPrompt: string;
  private maxTokens: number;
  private temperature: number;
  private emulator: V86Wrapper | null = null;
  private isProcessing: boolean = false;
  private history: AIAgentMessage[] = [];
  private lastOutput: string = "";
  private onUpdateCallbacks: Array<(state: AIAgentState) => void> = [];
  private abortController: AbortController | null = null;

  constructor(options: AIAgentOptions) {
    this.model = options.model;
    this.task = options.task;
    this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
    this.maxTokens = options.maxTokens || 1024;
    this.temperature = options.temperature || 0.7;

    // Add system prompt to history
    this.history.push({
      role: "system",
      content: this.systemPrompt,
      timestamp: new Date()
    });

    // Add task to history
    if (this.task) {
      this.history.push({
        role: "user",
        content: this.task,
        timestamp: new Date()
      });
    }
  }

  public setEmulator(emulator: V86Wrapper): void {
    this.emulator = emulator;

    // Subscribe to emulator updates
    emulator.onUpdate((state) => {
      this.notifyUpdate();
    });
  }

  private getDefaultSystemPrompt(): string {
    return `You are an AI agent operating in an emulated x86 environment. 
You can see the screen and interact with the system using keyboard inputs.
Your goal is to complete tasks given to you by the user.
You should think step by step and explain your reasoning.
When you need to perform an action, use the appropriate command format:
- To type text: \`TYPE: your text here\`
- To press special keys: \`KEY: Enter\` or \`KEY: Tab\` or \`KEY: Escape\` etc.
- To analyze the screen: \`ANALYZE: what you see on the screen\`
- To think without taking action: \`THINK: your thoughts here\`

Always wait for the result of your previous action before taking the next one.`;
  }

  public async start(): Promise<void> {
    if (!this.emulator) {
      throw new Error("Emulator not set");
    }

    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.notifyUpdate();

    try {
      // Take a screenshot to analyze the current state
      const screenshot = await this.emulator.takeScreenshot();
      
      // Add the screenshot to the context
      if (screenshot) {
        this.history.push({
          role: "system",
          content: `Current screen state: [SCREENSHOT]`,
          timestamp: new Date()
        });
      }

      // Start the agent loop
      await this.processNextStep();
    } catch (error) {
      console.error("Error starting AI agent:", error);
      this.isProcessing = false;
      this.notifyUpdate();
    }
  }

  public async sendUserMessage(message: string): Promise<void> {
    if (!this.emulator) {
      throw new Error("Emulator not set");
    }

    // Add user message to history
    this.history.push({
      role: "user",
      content: message,
      timestamp: new Date()
    });

    // If not already processing, start processing
    if (!this.isProcessing) {
      await this.start();
    } else {
      // If already processing, just notify update
      this.notifyUpdate();
    }
  }

  private async processNextStep(): Promise<void> {
    if (!this.emulator) {
      throw new Error("Emulator not set");
    }

    try {
      // Get AI response
      const aiResponse = await this.getAIResponse();
      
      // Add AI response to history
      this.history.push({
        role: "assistant",
        content: aiResponse,
        timestamp: new Date()
      });
      
      this.lastOutput = aiResponse;
      this.notifyUpdate();

      // Process AI commands
      await this.processAICommands(aiResponse);
      
      // Continue the loop if still processing
      if (this.isProcessing) {
        // Take a new screenshot for the next iteration
        await this.emulator.takeScreenshot();
        
        // Schedule next step
        setTimeout(() => this.processNextStep(), 1000);
      }
    } catch (error) {
      console.error("Error in AI agent loop:", error);
      this.isProcessing = false;
      this.notifyUpdate();
    }
  }

  private async getAIResponse(): Promise<string> {
    // Create a simplified context for the AI
    const context = this.history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Create a new abort controller for this request
    this.abortController = new AbortController();

    try {
      // In a real implementation, this would call an actual AI API
      // For now, we'll simulate a response based on the model
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, return a simulated response
      return this.getSimulatedResponse();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return "Request was cancelled.";
      }
      throw error;
    }
  }

  private getSimulatedResponse(): string {
    // This is just a placeholder for demonstration
    // In a real implementation, this would be replaced with actual API calls
    
    const lastUserMessage = this.history.filter(msg => msg.role === "user").pop()?.content || "";
    const lastScreenshot = this.emulator?.getScreenshot() ? "I can see the screen." : "I don't see anything on the screen yet.";
    
    if (lastUserMessage.toLowerCase().includes("google")) {
      return `ANALYZE: ${lastScreenshot} I can see we need to open Google.
THINK: I'll need to find a web browser and open it first.
TYPE: firefox
KEY: Enter`;
    } else if (lastUserMessage.toLowerCase().includes("file")) {
      return `ANALYZE: ${lastScreenshot} I need to create a file.
THINK: I'll use a text editor to create a new file.
TYPE: nano newfile.txt
KEY: Enter`;
    } else {
      return `ANALYZE: ${lastScreenshot}
THINK: I'm exploring the environment to understand what's available.
TYPE: ls -la
KEY: Enter`;
    }
  }

  private async processAICommands(response: string): Promise<void> {
    if (!this.emulator) {
      return;
    }

    // Parse commands from the response
    const typeMatch = response.match(/TYPE: (.*?)($|\n)/);
    const keyMatch = response.match(/KEY: (.*?)($|\n)/);
    
    // Process TYPE command
    if (typeMatch && typeMatch[1]) {
      const textToType = typeMatch[1].trim();
      await this.emulator.sendText(textToType);
    }
    
    // Process KEY command
    if (keyMatch && keyMatch[1]) {
      const keyToPress = keyMatch[1].trim();
      await this.emulator.sendSpecialKey(keyToPress);
    }
  }

  public stop(): void {
    this.isProcessing = false;
    
    // Abort any ongoing API requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    this.notifyUpdate();
  }

  public getState(): AIAgentState {
    return {
      isProcessing: this.isProcessing,
      lastOutput: this.lastOutput,
      lastScreenshot: this.emulator?.getScreenshot() || null,
      history: [...this.history]
    };
  }

  public onUpdate(callback: (state: AIAgentState) => void): () => void {
    this.onUpdateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyUpdate(): void {
    const state = this.getState();
    this.onUpdateCallbacks.forEach(callback => callback(state));
  }
} 