import * as vscode from 'vscode';
import { WorkspaceManager } from '../WorkspaceManager';

interface ISetRepoPath {
  path: string;
}

export class SelectRepoTool implements vscode.LanguageModelTool<ISetRepoPath> {
  readonly name = 'select_repo';

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ISetRepoPath>
  ) {
    const workspaceManager = WorkspaceManager.getInstance();
    const inputPath = options.input.path.trim();

    const allRepos = workspaceManager.getAvailableRepos();
    const matchedRepo = allRepos.find((r) => r.path === inputPath);

    if (matchedRepo) {
      workspaceManager.setSelectedRepo(matchedRepo.path);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Git repository set to: ${matchedRepo.label}`
        ),
      ]);
    } else {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Invalid repository path: ${inputPath}`
        ),
      ]);
    }
  }
}

export class ListReposTool implements vscode.LanguageModelTool<{}> {
  readonly name = 'list_repos';

  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const workspaceManager = WorkspaceManager.getInstance();
    const repos = workspaceManager.getAvailableRepos();

    const lines = repos.map((repo) => `- ${repo.label}: ${repo.path}`);
    const output = `Available Git Repositories:\n\n${lines.join('\n')}`;

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(output),
    ]);
  }
}
