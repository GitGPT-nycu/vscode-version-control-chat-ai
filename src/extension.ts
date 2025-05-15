import * as vscode from 'vscode';
import { WebviewController } from './WebviewController';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceManager } from './WorkspaceManager';
import { SelectRepoTool, ListReposTool } from './tools/SelectRepoTool';
import { OpenGitLogViewerTool } from './tools/OpenGitLogViewerTool';
import { VisualizeGitLogTool } from './tools/VisualizeGitLogTool';
import { GetGitLogTool } from './tools/GetGitLog';
import { resolveEffectiveGitLogs } from './git';
import { VirtualRepoStateManager } from './VirtualRepoStateManager';

export function activate(context: vscode.ExtensionContext) {
  // const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  // statusBar.tooltip = "Current Git Repository";
  // statusBar.text = "$(repo) Git: (none)";
  // statusBar.show();

  VirtualRepoStateManager.init();
  WebviewController.init(context);
  WorkspaceManager.init();

  const workspaceManager = WorkspaceManager.getInstance();
  const webviewController = WebviewController.getInstance();

  workspaceManager.onRepoChanged(async (repoPath) => {
    if (!repoPath) {
      return;
    }

    // const shortName = vscode.workspace.asRelativePath(repoPath, false);
    // statusBar.text = `$(repo) Git: ${shortName}`;

    const logs = await resolveEffectiveGitLogs(repoPath);
    if (!logs) {
      return;
    }

    WebviewController.getInstance().sendMessage({
      type: 'getGitLog',
      payload: {
        path: repoPath,
        log: logs.before,
        afterLog: logs.after,
      },
    });
  });

  workspaceManager.onRepoRegistered((repoPath) => {
    const repos = workspaceManager.getAvailableRepos();

    webviewController.sendMessage({
      type: 'getAvailableRepo',
      payload: {
        repos: repos.map((repo: any) => ({
          label: repo.label,
          description: repo.description,
          path: repo.path,
        })),
      },
    });
  });

  webviewController.onDidReceiveMessage((message) => {
    if (message.type === 'switchRepo') {
      const path = message.payload.path;
      workspaceManager.setSelectedRepo(path);
    }
  });

  const openGitLogViewer = vscode.commands.registerCommand(
    'gitgpt.openGitLogViewer',
    async () => {
      try {
        if (webviewController.isVisible()) {
          webviewController.disposePanel(); // toggle off
          return;
        }

        await webviewController.createPanel();

        const repos = workspaceManager.getAvailableRepos();
        webviewController.sendMessage({
          type: 'getAvailableRepo',
          payload: {
            repos: repos.map((repo: any) => ({
              label: repo.label,
              description: repo.description,
              path: repo.path,
            })),
          },
        });

        const repoPath = workspaceManager.getCurrentRepoPath();

        const logs = await resolveEffectiveGitLogs(repoPath);
        if (!logs) {
          return;
        }

        WebviewController.getInstance().sendMessage({
          type: 'getGitLog',
          payload: {
            path: repoPath,
            log: logs.before,
            afterLog: logs.after,
          },
        });
      } catch (e: any) {
        vscode.window.showErrorMessage(e);
        return;
      }
    }
  );

  const selectRepo = vscode.commands.registerCommand(
    'gitgpt.selectRepo',
    async () => {
      const choices = workspaceManager.getAvailableRepos();
      const picked = await vscode.window.showQuickPick(choices, {
        placeHolder: '選擇 Git 存放庫',
      });
      if (picked) {
        workspaceManager.setSelectedRepo(picked.path);
      }
    }
  );

  context.subscriptions.push(openGitLogViewer, selectRepo);

  // 註冊 LLM 工具
  context.subscriptions.push(
    vscode.lm.registerTool('open_git_log_viewer', new OpenGitLogViewerTool()),
    vscode.lm.registerTool('visualize_git_log', new VisualizeGitLogTool()),
    // vscode.lm.registerTool("select_repo", new SelectRepoTool()),
    // vscode.lm.registerTool("list_repos", new ListReposTool()),
    vscode.lm.registerTool('get_git_log', new GetGitLogTool())
  );

  ensureGitHubMcpServerRegistered();
}

export function deactivate() {}

export async function ensureGitHubMcpServerRegistered() {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) {
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
      vscode.window.showErrorMessage(
        '無法解析 .vscode/mcp.json，請確認其內容是否正確 JSON 格式'
      );
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

  if (userChoice !== '加入') {
    return;
  }

  const githubServerConfig = {
    inputs: [
      {
        type: 'promptString',
        id: 'github_token',
        description: 'GitHub Personal Access Token',
        password: true,
      },
    ],
    servers: {
      github: {
        command: 'docker',
        args: [
          'run',
          '-i',
          '--rm',
          '-e',
          'GITHUB_PERSONAL_ACCESS_TOKEN',
          'ghcr.io/github/github-mcp-server',
        ],
        env: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          GITHUB_PERSONAL_ACCESS_TOKEN: '${input:github_token}',
        },
      },
    },
  };

  const updatedConfig = {
    inputs: currentConfig.inputs ?? [
      {
        type: 'promptString',
        id: 'github_token',
        description: 'GitHub Personal Access Token',
        password: true,
      },
    ],
    servers: {
      ...currentConfig.servers,
      github: githubServerConfig,
    },
  };

  fs.mkdirSync(vscodeFolder, { recursive: true });
  fs.writeFileSync(mcpPath, JSON.stringify(updatedConfig, null, 2), 'utf8');

  vscode.window.showInformationMessage(
    'GitHub MCP Server 將被加入設定中，請確保你已啟動 Docker 來運行 GitHub MCP Server。'
  );
}
