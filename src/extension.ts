import * as vscode from "vscode";
import { Flow } from "./git-llm"
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
const exec = promisify(execCb);
import { WebviewPanel } from './WebviewPanel';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceManager } from './WorkspaceManager';
import { SetWorkspaceTool } from './tools/SetWorkspaceTool';
import { OpenGitLogViewerTool } from './tools/OpenGitLogViewerTool';
import { VisualizeGitLogTool } from './tools/VisualizeGitLogTool';
import { GetGitLogTool } from './tools/GetGitLog';
import { getGitLogText } from './git';


export async function ensureGitHubMcpServerRegistered(context: vscode.ExtensionContext,
    workspaceManager: WorkspaceManager) {
    let workspacePath: string;
    try {
        workspacePath = workspaceManager.getCurrentWorkspace();
    } catch (e) {
        return;
    }
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
    WorkspaceManager.init(context);
    WebviewPanel.init(context);

    const workspaceManager = WorkspaceManager.getInstance();

    const openGitLogViewer = vscode.commands.registerCommand(
        "gitgpt.openGitLogViewer",
        async () => {
            const webviewPanel = WebviewPanel.getInstance();
            let cwd: string;
            try {
                cwd = workspaceManager.getCurrentWorkspace();
            } catch (e: any) {
                vscode.window.showErrorMessage(e);
                return;
            }

            const gitLog = await getGitLogText(cwd);
            if (gitLog) {
                webviewPanel.sendMessage({ type: 'git_log', gitLog });
            }
        }
    );

    const selectWorkspaceCommand = vscode.commands.registerCommand("gitgpt.selectWorkspace", async () => {
        const folderPath = await workspaceManager.selectWorkspaceFolder();
        if (folderPath) {
            workspaceManager.setWorkspace(folderPath);
            vscode.window.showInformationMessage(`Selected workspace: ${folderPath}`);
        }
    })

    const setWorkspaceCommand = vscode.commands.registerCommand("gitgpt.setWorkspace", (folderPath: string) => {
        const success = workspaceManager.setWorkspace(folderPath);
        if (success) {
            vscode.window.showInformationMessage(`Workspace set to: ${folderPath}`);
        } else {
            vscode.window.showErrorMessage(`Invalid workspace path: ${folderPath}`);
        }
    })

    context.subscriptions.push(openGitLogViewer, selectWorkspaceCommand, setWorkspaceCommand);

    // 註冊 LLM 工具
    context.subscriptions.push(
        vscode.lm.registerTool('open_git_log_viewer', new OpenGitLogViewerTool()),
        vscode.lm.registerTool('show_git_log_message', new VisualizeGitLogTool()),
        vscode.lm.registerTool('set_workspace', new SetWorkspaceTool()),
        vscode.lm.registerTool('get_git_log', new GetGitLogTool())
    );

    ensureGitHubMcpServerRegistered(context, workspaceManager);


    ////
    let currentRepoPath: string | null = null;
    let isAutoMode: boolean = true;

    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    const gitAPI = gitExtension?.getAPI(1);

    if (!gitAPI) {
        vscode.window.showErrorMessage('無法取得 vscode.git 擴充功能');
        return;
    }

    // 建立 Status Bar 控制項
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.command = 'customGit.selectRepo';
    statusBarItem.tooltip = '目前使用中的 Git 存放庫';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    gitAPI.onDidOpenRepository((repo: { rootUri: { fsPath: any; }; state: { onDidChange: (arg0: () => void) => void; HEAD: { name: any; }; }; }) => {
        console.log('Repo opened:', repo.rootUri.fsPath);

        repo.state.onDidChange(() => {
            if (!isAutoMode && currentRepoPath && currentRepoPath === repo.rootUri.fsPath) {
                updateStatusBar(repo);
            }
        });

        const editor = vscode.window.activeTextEditor;
        const uri = editor?.document?.uri;
        if (uri && uri.fsPath.startsWith(repo.rootUri.fsPath)) {
            updateStatusBar(repo);
        }
    });

    function updateStatusBar(repo: any | null) {
        if (repo) {
            currentRepoPath = repo.rootUri.fsPath;
            const repoName = path.basename(currentRepoPath!);
            statusBarItem.text = `$(repo) ${repoName}`;
        } else {
            currentRepoPath = null;
            statusBarItem.text = '$(repo) No Repo';
        }
    }

    function updateStatusBarAuto(fileUri: vscode.Uri) {
        if (!isAutoMode) return;
        const repo = gitAPI.getRepository(fileUri);
        updateStatusBar(repo);
    }

    // 根據目前開啟的檔案自動切換 repo
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor?.document?.uri) {
            updateStatusBarAuto(editor.document.uri);
        }
    });


    // 點選 Status Bar：手動選擇 repo 或自動模式
    vscode.commands.registerCommand('customGit.selectRepo', async () => {
        const choices = [
            {
                label: '自動',
                description: '根據目前檔案自動切換',
                auto: true,
            },
            ...gitAPI.repositories.map((repo: { rootUri: { fsPath: string; }; }) => (
                {
                    label: path.basename(repo.rootUri.fsPath),
                    description: repo.rootUri.fsPath,
                    repo,
                    auto: false,
                })),
        ];

        const picked = await vscode.window.showQuickPick(choices, {
            placeHolder: '選擇 Git 存放庫',
        });

        if (!picked) return;

        if (picked.auto) {
            isAutoMode = true;
            const editor = vscode.window.activeTextEditor;
            if (editor) updateStatusBarAuto(editor.document.uri);
            console.log(`[Switch] 切換為自動模式`);
        } else {
            isAutoMode = false;
            currentRepoPath = picked.repo.rootUri.fsPath;
            updateStatusBar(picked.repo);
            console.log(`[Switch] 鎖定 repo：${picked.label}`);
        }
    });

    // 初始啟動狀態列
    const activeUri = vscode.window.activeTextEditor?.document?.uri;
    if (activeUri) updateStatusBarAuto(activeUri);
}


export function deactivate() { }
