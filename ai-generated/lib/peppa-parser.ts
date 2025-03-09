import yaml from 'js-yaml';

export interface PeppaConfig {
  name: string;
  description?: string;
  os: "linux" | "windows" | "freedos";
  aiModel: "deepseek" | "gemini" | "claude";
  task: string;
  systemPrompt?: string;
  options?: {
    memory?: number;
    vgaMemory?: number;
    networkEnabled?: boolean;
    persistState?: boolean;
    autostart?: boolean;
  };
}

export class PeppaParser {
  /**
   * Parse a .peppa YAML file content
   */
  public static parse(content: string): PeppaConfig {
    try {
      const parsed = yaml.load(content) as any;
      
      // Validate required fields
      if (!parsed.name) {
        throw new Error("Missing required field: name");
      }
      
      if (!parsed.os) {
        throw new Error("Missing required field: os");
      }
      
      if (!parsed.aiModel) {
        throw new Error("Missing required field: aiModel");
      }
      
      if (!parsed.task) {
        throw new Error("Missing required field: task");
      }
      
      // Validate OS type
      if (!["linux", "windows", "freedos"].includes(parsed.os)) {
        throw new Error("Invalid OS type. Must be one of: linux, windows, freedos");
      }
      
      // Validate AI model
      if (!["deepseek", "gemini", "claude"].includes(parsed.aiModel)) {
        throw new Error("Invalid AI model. Must be one of: deepseek, gemini, claude");
      }
      
      // Create config object
      const config: PeppaConfig = {
        name: parsed.name,
        description: parsed.description || "",
        os: parsed.os,
        aiModel: parsed.aiModel,
        task: parsed.task,
        systemPrompt: parsed.systemPrompt || undefined,
        options: {
          memory: parsed.options?.memory || undefined,
          vgaMemory: parsed.options?.vgaMemory || undefined,
          networkEnabled: parsed.options?.networkEnabled !== undefined ? parsed.options.networkEnabled : true,
          persistState: parsed.options?.persistState !== undefined ? parsed.options.persistState : false,
          autostart: parsed.options?.autostart !== undefined ? parsed.options.autostart : true,
        }
      };
      
      return config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse .peppa file: ${error.message}`);
      } else {
        throw new Error("Failed to parse .peppa file");
      }
    }
  }
  
  /**
   * Generate a .peppa YAML file content from a config object
   */
  public static generate(config: PeppaConfig): string {
    try {
      return yaml.dump(config);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate .peppa file: ${error.message}`);
      } else {
        throw new Error("Failed to generate .peppa file");
      }
    }
  }
  
  /**
   * Create a default .peppa config
   */
  public static createDefault(name: string, task: string): PeppaConfig {
    return {
      name,
      description: "Default Peppa environment",
      os: "linux",
      aiModel: "deepseek",
      task,
      options: {
        memory: 128,
        vgaMemory: 8,
        networkEnabled: true,
        persistState: false,
        autostart: true,
      }
    };
  }
} 