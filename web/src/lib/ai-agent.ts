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
}

export interface AIAgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: Date;
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
  private history: AIAgentMessage[] = [];
  private lastOutput: string = "";
  private onUpdateCallbacks: Array<(state: AIAgentState) => void> = [];
  private abortController: AbortController | null = null;
  private aiModel: AIModel;

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
    this.history.push({
      role: "system",
      content: this.systemPrompt,
      timestamp: new Date(),
    });
  }

  public setEmulator(emulator: V86Wrapper): void {
    this.emulator = emulator;
  }

  private getDefaultSystemPrompt(): string {
    return `You are an AI assistant helping with a ${this.task} task. 
    You are connected to a virtual machine running on the user's computer.
    You can see what's on the screen and execute commands.
    Please help the user accomplish their task by providing guidance and executing commands when necessary.
    Always be helpful, concise, and focus on the task at hand.`;
  }

  public async start(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.notifyUpdate();

    try {
      // Get initial screenshot
      if (this.emulator) {
        await this.emulator.takeScreenshot();
      }

      // Add initial assistant message
      const initialResponse = `Hello! I'm your AI assistant for ${this.task}. I'll help you accomplish this task using the virtual machine. What would you like to do first?`;
      
      this.history.push({
        role: "assistant",
        content: initialResponse,
        timestamp: new Date(),
      });
      
      this.lastOutput = initialResponse;
      this.notifyUpdate();
    } catch (error) {
      console.error("Error starting AI agent:", error);
    } finally {
      this.isProcessing = false;
      this.notifyUpdate();
    }
  }

  public async sendUserMessage(message: string): Promise<void> {
    if (this.isProcessing) return;

    // Add user message to history
    this.history.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    this.notifyUpdate();

    // Process the message
    await this.processNextStep();
  }

  private async processNextStep(): Promise<void> {
    this.isProcessing = true;
    this.notifyUpdate();

    try {
      // Get latest screenshot
      if (this.emulator) {
        await this.emulator.takeScreenshot();
      }

      // Get AI response
      const response = await this.getAIResponse();

      // Add response to history
      this.history.push({
        role: "assistant",
        content: response,
        timestamp: new Date(),
      });

      this.lastOutput = response;
      this.notifyUpdate();

      // Process any commands in the response
      await this.processAICommands(response);
    } catch (error) {
      console.error("Error in AI agent loop:", error);
    } finally {
      this.isProcessing = false;
      this.notifyUpdate();
    }
  }

  private async getAIResponse(): Promise<string> {
    // Create a simplified context for the AI
    const context = this.history.map(msg => ({
      role: msg.role,
      content: msg.content
    })) as AIMessage[];

    // Create a new abort controller for this request
    this.abortController = new AbortController();

    try {
      // Get screenshot if available
      let screenshotContext = "";
      const screenshot = this.emulator?.getScreenshot();
      if (screenshot) {
        screenshotContext = `[Current screen state: The screen shows a virtual machine display. Here's a text description of what's visible: A command interface is shown.]`;
        
        // Add screenshot context as a system message
        context.push({
          role: "system",
          content: screenshotContext
        });
      }

      // Use the AI model to generate a response
      return await this.aiModel.generateCompletion(context);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return "Request was cancelled.";
      }
      console.error("Error getting AI response:", error);
      return "I'm sorry, I encountered an error processing your request.";
    }
  }

  private async processAICommands(response: string): Promise<void> {
    // Extract and execute commands from the AI response
    // This is a simplified approach - a real implementation would use a more robust parser
    
    const commandMatch = response.match(/```([\s\S]*?)```/);
    if (commandMatch && commandMatch[1] && this.emulator) {
      const command = commandMatch[1].trim();
      console.log("Executing command:", command);
      
      // Send the command to the emulator
      await this.emulator.sendText(command + "\n");
    }
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    this.isProcessing = false;
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
    
    // Return a function to remove this callback
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyUpdate(): void {
    const state = this.getState();
    this.onUpdateCallbacks.forEach(callback => callback(state));
  }
} 