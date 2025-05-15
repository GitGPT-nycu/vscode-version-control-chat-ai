import * as vscode from 'vscode';
import { WebviewController } from '../WebviewController';
import { WorkspaceManager } from '../WorkspaceManager';
import { VirtualRepoStateManager } from '../VirtualRepoStateManager';

export class OpenGitLogViewerTool implements vscode.LanguageModelTool<{}> {
  readonly name = 'open_git_log_viewer';
  webviewController = WebviewController.getInstance();
  workspaceManager = WorkspaceManager.getInstance();
  virtualRepoManager = VirtualRepoStateManager.getInstance();

  async invoke() {
    try {
      await vscode.commands.executeCommand('gitgpt.openGitLogViewer');
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Git Log Viewer has been opened.'),
      ]);
    } catch (e: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Failed to open Git Log Viewer: ${e.message || e}`
        ),
      ]);
    }
  }
}
