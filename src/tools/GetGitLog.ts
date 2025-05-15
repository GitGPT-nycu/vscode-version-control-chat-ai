import * as vscode from 'vscode';
import { getRawGitLogFromRepo } from '../git';
import { WorkspaceManager } from '../WorkspaceManager';

interface IGetGitLog {
  path: string;
}

export class GetGitLogTool implements vscode.LanguageModelTool<IGetGitLog> {
  readonly name = 'get_git_log';

  constructor() {}

  async invoke(options: vscode.LanguageModelToolInvocationOptions<IGetGitLog>) {
    const filePath = options.input.path;
    if (!filePath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Missing input path.'),
      ]);
    }

    const fileUri = vscode.Uri.file(filePath);
    const repo = WorkspaceManager.getInstance()
      .getGitAPI()
      .getRepository(fileUri);

    if (!repo || !repo.rootUri) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No git repository found for the given path.'
        ),
      ]);
    }

    const log = await getRawGitLogFromRepo(repo.rootUri.fsPath);
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(log ?? 'Failed to get git log.'),
    ]);
  }
}
