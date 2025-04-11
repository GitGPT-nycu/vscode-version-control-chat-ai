import * as vscode from "vscode";
import { Flow } from "./git-llm"
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
const exec = promisify(execCb);
import { WebviewPanel } from './webviewPanel';
import * as path from 'path';
import * as fs from 'fs';


// class WorkspaceManager {
//     private currentWorkspace: string | undefined;
//     private statusBarItem: vscode.StatusBarItem;

//     constructor(context: vscode.ExtensionContext) {
//         // 初始化 Status Bar Item
//         this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
//         this.statusBarItem.command = "gitgpt.selectWorkspace";
//         this.currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
//         this.updateStatusBarItem();

//         const selectWorkspaceCommand = vscode.commands.registerCommand("gitgpt.selectWorkspace", async () => {
//             const folderPath = await this.selectWorkspaceFolder();
//             if (folderPath) {
//                 vscode.window.showInformationMessage(`Selected workspace folder: ${folderPath}`);
//                 this.currentWorkspace = folderPath;
//                 this.updateStatusBarItem();
//             }
//         });

//         context.subscriptions.push(selectWorkspaceCommand, this.statusBarItem);
//     }

//     // 選擇 Workspace 資料夾
//     private async selectWorkspaceFolder(): Promise<string | undefined> {
//         const folderUri = await vscode.window.showOpenDialog({
//             defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
//             canSelectFiles: false,
//             canSelectFolders: true,
//             canSelectMany: false,
//             openLabel: "選擇資料夾",
//         });

//         return folderUri?.[0]?.fsPath;
//     }

//     // 更新 Status Bar Item 顯示
//     private updateStatusBarItem() {
//         if (this.currentWorkspace) {
//             const folderName = path.basename(this.currentWorkspace);
//             this.statusBarItem.text = `$(folder) ${folderName}`;
//             this.statusBarItem.tooltip = this.currentWorkspace;
//         } else {
//             this.statusBarItem.text = `$(folder) No Workspace`;
//             this.statusBarItem.tooltip = "No workspace folder selected";
//         }
//         this.statusBarItem.show();
//     }

//     // 獲取當前 Workspace
//     public getCurrentWorkspace(): string {
//         if (!this.currentWorkspace) {
//             throw new Error("No workspace folder is open.");
//         }
//         return this.currentWorkspace;
//     }
// }


export async function ensureGitHubMcpServerRegistered(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const vscodeFolder = path.join(workspacePath, '.vscode');
    const mcpPath = path.join(vscodeFolder, 'mcp.json');

    let currentConfig: any = {};
    if (fs.existsSync(mcpPath)) {
        try {
            const raw = fs.readFileSync(mcpPath, 'utf8');
            currentConfig = JSON.parse(raw);
        } catch (e) {
            vscode.window.showErrorMessage('無法解析 .vscode/mcp.json，請確認其內容是否正確 JSON 格式');
            return;
        }

        if (currentConfig.servers?.github) {
            // 已有 github server，不覆蓋
            return;
        }
    }

    // 詢問是否加入 GitHub MCP server
    const userChoice = await vscode.window.showInformationMessage(
        '是否要加入 GitHub 官方 MCP Server？',
        '加入',
        '略過'
    );

    if (userChoice !== '加入') return;

    const githubServerConfig = {
        inputs: [
            {
                type: "promptString",
                id: "github_token",
                description: "GitHub Personal Access Token",
                password: true
            }
        ],
        servers: {
            github: {
                command: "docker",
                args: [
                    "run",
                    "-i",
                    "--rm",
                    "-e",
                    "GITHUB_PERSONAL_ACCESS_TOKEN",
                    "ghcr.io/github/github-mcp-server"
                ],
                env: {
                    GITHUB_PERSONAL_ACCESS_TOKEN: "${input:github_token}"
                }
            }
        }
    };

    const updatedConfig = {
        inputs: currentConfig.inputs ?? [
            {
                type: "promptString",
                id: "github_token",
                description: "GitHub Personal Access Token",
                password: true
            }
        ],
        servers: {
            ...currentConfig.servers,
            github: githubServerConfig
        }
    };

    fs.mkdirSync(vscodeFolder, { recursive: true });
    fs.writeFileSync(mcpPath, JSON.stringify(updatedConfig, null, 2), 'utf8');

    vscode.window.showInformationMessage(
        'GitHub MCP Server 將被加入設定中，請確保你已啟動 Docker 來運行 GitHub MCP Server。'
    );
}


class OpenGitLogViewerTool implements vscode.LanguageModelTool<{}> {
    readonly name = 'open_git_log_viewer';

    async invoke() {
        vscode.commands.executeCommand("gitgpt.openGitLogViewer");
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart("Git Log Viewer has been opened.")
        ]);
    }
}

interface IVisualizesGitLog {
    logTree: string;
}

class ShowGitLogTool implements vscode.LanguageModelTool<IVisualizesGitLog> {
    readonly name = 'visualize_git_log';

    constructor(private context: vscode.ExtensionContext) { }

    async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IVisualizesGitLog>) {
        return {
            invocationMessage: 'Visualizing mock Git log in Git Log Viewer',
            confirmationMessages: {
                title: 'Visualize Git Log Tree (AI-generated)',
                message: new vscode.MarkdownString(`Git Log (simulated):\n\n\`${options.input.logTree}\``)
            }
        };
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<IVisualizesGitLog>) {
        const panel = WebviewPanel.getInstance(this.context);
        panel?.sendMessage({ type: 'showLog', log: options.input.logTree });

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Visualized AI-generated Git log in the Git Log Viewer.`)
        ]);
    }
}

const gitLog = `
b01dd03 (wei) (10 minutes ago) (test)  (HEAD -> main) [c10ff55]
c10ff55 (wei) (23 minutes ago) (Merge branch 'branch-a')  (new_branch) [55a2428 b83fe92]
b83fe92 (wei) (25 minutes ago) (Merge branch 'branch-a-1' into branch-a)  (branch-a) [97e5ab2 9091626]
97e5ab2 (wei) (26 minutes ago) (feat: add txta)  [de5383e]
9091626 (wei) (27 minutes ago) (feat: add txta-1)  (branch-a-1) [de5383e]
55a2428 (wei) (43 minutes ago) (Merge branch 'branch-b')  [25998ce 397f1ce]
25998ce (wei) (45 minutes ago) (update: txt2:)  [e8499cf]
e8499cf (wei) (2 hours ago) (feat: delete txt)  [e43037a]
397f1ce (wei) (2 hours ago) (feat: completed a new feature)  (branch-b) [517ae00]
e43037a (wei) (2 hours ago) (feat: add txt3)  [2c29e88]
517ae00 (wei) (2 hours ago) (feat: do some change)  [2c29e88]
de5383e (wei) (2 hours ago) (feat: add some texts)  [2c29e88]
2c29e88 (wei) (2 hours ago) (feat: add txt2)  [9cf44f3]
9cf44f3 (wei) (2 hours ago) (feat: complete feature a)  (branch-1) [0f1d08b]
0f1d08b (wei) (2 hours ago) (init commit)  []`

export function activate(context: vscode.ExtensionContext) {
    const openGitLogViewer = vscode.commands.registerCommand(
        "gitgpt.openGitLogViewer",
        async () => {
            const webviewPanel = WebviewPanel.getInstance(context);
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            // 檢查工作區是否存在
            if (!cwd) {
                vscode.window.showErrorMessage("No workspace folder is open.");
                return;
            }

            // 檢查是否有 .git 資料夾
            const gitFolderPath = path.join(cwd, '.git');
            if (!fs.existsSync(gitFolderPath)) {
                vscode.window.showErrorMessage(`.git directory not found. Ensure {${cwd}} is a Git repository.`);
                return;
            }

            // 確認 Git 安裝
            try {
                const { stdout } = await exec('git --version');
                vscode.window.showInformationMessage(stdout.trim());
            } catch (error: any) {
                vscode.window.showErrorMessage('Git is not installed or not in PATH. Please install Git to use this feature.');
                return;
            }

            try {
                const { stdout } = await exec(
                    'git log --all --pretty=format:"%h (%an) (%ar) (%s) %d [%p]"',
                    { cwd }
                );

                webviewPanel.sendMessage({
                    type: "git_log",
                    gitLog: stdout
                });
            } catch (err: any) {
                vscode.window.showErrorMessage(err.stderr);
            }
        }
    );

    context.subscriptions.push(openGitLogViewer);

    // 註冊 LLM 工具
    context.subscriptions.push(
        vscode.lm.registerTool('open_git_log_viewer', new OpenGitLogViewerTool()),
        vscode.lm.registerTool('show_git_log_message', new ShowGitLogTool(context))
    );

    ensureGitHubMcpServerRegistered(context);
}

export function deactivate() { }
