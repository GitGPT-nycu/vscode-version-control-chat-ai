import { config } from "dotenv";
import { WebviewPanel } from "../WebviewPanel";
import { Message } from "./types";
import { runCommandCompose } from "./utils";
import LLM from "./llm";
import { GITGPT_PROMPT } from "./prompt";

config();

interface ToolCall {
  function: {
    name: string;
    arguments: string;
  };
  id: string;
  type: string;
}

class LLM_Message {
  messages: Message[];

  constructor(task: string) {
    this.messages = [];
    this.addMessage("system", GITGPT_PROMPT);
    this.addMessage("user", this.taskToMessages(task));
  }

  private taskToMessages(task: string): string {
    return `\`\`\`### 任務\n\分析以下使用者需求任務：\n${task}\`\`\``;
  }

  addMessage(
    role: Message["role"],
    content: Message["content"] = "",
    toolId?: string,
    functionName?: string,
    toolCalls?: ToolCall[]
  ) {
    if (toolId) {
      this.messages.push({
        role: "tool",
        content,
        name: functionName,
        tool_call_id: toolId,
      });
    } else if (toolCalls) {
      this.messages.push({ role, content, tool_calls: toolCalls });
    } else {
      this.messages.push({ role, content });
    }
  }
}

class Flow {
  private panel: WebviewPanel;
  llmMessages: LLM_Message;
  llm: LLM;
  path: string;
  llmOutput: any;

  constructor(path: string, task: string, panel: WebviewPanel) {
    this.panel = panel;
    this.llmMessages = new LLM_Message(task);
    this.llm = new LLM();
    this.path = path;
    this.llmOutput = null;
  }

  private async executeCommand(command: string): Promise<string> {
    let output = `執行指令：${command}\n`;
    if (await this.llm.securityCheck(command)) {
      const yn = await this.askUser(
        `你要執行這個可能無法恢復的指令嗎？\n${command}`,
        ["Y", "N"]
      );
      if (yn?.trim().toLowerCase() !== "y") {
        return "Command is non-secure and user declined to execute.";
      }
    }
    const res = await runCommandCompose(command, this.path);
    output += res;
    this.sendToPanel(output);
    return res;
  }

  private askUser(message: string, options: string[]): Promise<any> {
    return new Promise((resolve) => {
      const messageId = Math.random().toString(36).substring(7);
      const messageToSend = { type: "ask_user", message, options, messageId };

      this.panel.sendMessage(messageToSend);

      const disposable = this.panel.onDidReceiveMessage((message) => {
        if (message.type === "ask_user_response" && message.id === messageId) {
          disposable.dispose();
          resolve(message.answer);
        }
      });
    });
  }

  private getGitLog(): Promise<string> {
    return runCommandCompose("git log --all --format=format:'%h (%an) (%ar) (%s) %d [%p]'", this.path, true);
  }

  private async sendGitLog(): Promise<void> {
    const gitLog = await this.getGitLog();
    this.panel.sendMessage({ type: "git_log", gitLog });
  }

  private sendToPanel(message: string): void {
    this.panel.sendMessage({ type: "message", message });
  }

  private async callLLM(): Promise<any> {
    return await this.llm.callLLM(this.llmMessages.messages, {
      temperature: 0.1,
    });
  }

  private async parseOutput(llmOutput: any): Promise<boolean> {
    const { content, tool_calls: toolCalls } = llmOutput;

    if (content) {
      this.llmMessages.addMessage(llmOutput.role, content);
      this.sendToPanel(content);
    } else if (toolCalls) {
      const availableFunctions: Record<string, Function> = {
        execute_command: this.executeCommand.bind(this),
        ask_user: this.askUser.bind(this),
      };

      const resToolCalls: ToolCall[] = toolCalls.map((toolCall: any) => ({
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
        id: toolCall.id,
        type: "function",
      }));

      this.llmMessages.addMessage(
        llmOutput.role,
        "",
        undefined,
        undefined,
        resToolCalls
      );

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);

        const functionResponse = await functionToCall(
          ...Object.values(functionArgs)
        );

        this.llmMessages.addMessage(
          functionName,
          functionResponse,
          toolCall.id
        );
      }

      return true;
    }

    return false;
  }

  async run(): Promise<void> {
    while (true) {
      this.sendGitLog();
      const llmOutput = await this.callLLM();
      const isContinue = await this.parseOutput(llmOutput);
      this.sendGitLog();

      if (!isContinue) {
        this.sendToPanel("流程結束。");
        break;
      }
    }
  }
}

export { LLM_Message, Flow };
