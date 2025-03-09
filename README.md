# Peppa - AI Agents in Emulated Environments

Peppa is a framework that allows AI agents (like DeepSeek, Gemini, Claude) to operate emulated x86 GUI & CLI machines. It provides a seamless way to create isolated environments where AI agents can complete tasks in real operating systems.

## Features

- **Multiple AI Models**: Support for DeepSeek, Gemini, and Claude AI models
- **x86 Emulation**: Uses v86 (copy.sh/v86) to provide realistic operating system environments
- **YAML Configuration**: Define tasks and environments using simple .peppa YAML files
- **Real-time Interaction**: Watch AI operate in real-time and interact through a web interface
- **Orchestration**: Manage multiple environments with an easy-to-use orchestration layer
- **Agent Feedback**: See what the AI is thinking and doing in real-time

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase account for authentication and data storage

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/peppa.git
   cd peppa/web
   ```

2. Install dependencies:
   ```
   bun install
   ```

3. Set up Firebase:
   - Create a Firebase project
   - Enable Authentication (Email/Password and Google)
   - Create a Firestore database
   - Copy your Firebase config to `.env.local` (use `.env.local.example` as a template)

4. Start the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Creating an Environment

1. Sign in to your account
2. Go to the Dashboard
3. Click "New Environment"
4. Configure your environment:
   - Name: Give your environment a name
   - OS: Choose from Linux, Windows, or FreeDOS
   - AI Model: Select DeepSeek, Gemini, or Claude
   - Task: Describe what you want the AI to do

### Using .peppa Files

You can define environments using YAML files with the `.peppa` extension:

```yaml
name: Open Google
description: Task to open Google in a web browser
os: linux
aiModel: deepseek
task: Open Google in a web browser and search for "Peppa AI"
systemPrompt: |
  You are an AI agent operating in a Linux environment.
  Your task is to open a web browser, navigate to Google, and perform a search.
  Think step by step and explain your reasoning.
options:
  memory: 256
  vgaMemory: 16
  networkEnabled: true
  persistState: false
  autostart: true
```

## Architecture

Peppa consists of several key components:

- **Frontend**: Next.js with Shadcn UI components
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore
- **Emulation**: v86 JavaScript x86 emulator
- **AI Integration**: API clients for various AI models

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GNU Public License - see the LICENSE file for details.

## Acknowledgments

- [v86](https://github.com/copy/v86) - JavaScript x86 emulator
- [Next.js](https://nextjs.org/) - React framework
- [Shadcn UI](https://ui.shadcn.com/) - UI components
- [Firebase](https://firebase.google.com/) - Authentication and database
