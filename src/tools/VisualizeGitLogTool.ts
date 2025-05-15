import * as vscode from 'vscode';
import { WebviewController } from '../WebviewController';
import { VirtualRepoStateManager } from '../VirtualRepoStateManager';
import { WorkspaceManager } from '../WorkspaceManager';

interface IVisualizesGitLog {
  beforeOperationLog: string;
  afterOperationLog: string;
}

export class VisualizeGitLogTool
  implements vscode.LanguageModelTool<IVisualizesGitLog>
{
  readonly name = 'visualize_git_log';

  constructor() {}

  private static parse(logText: string) {
    if (!logText || logText.trim() === '') {
      throw new Error('Empty git log input');
    }

    const lines = logText.trim().split('\n');
    const commits = [];

    const regex =
      /^([0-9a-f]+) \(([^)]+)\) \(([^)]+)\) \(([^)]+)\)(?:\s+\(([^)]*)\))?\s+\[([^\]]*)\]$/;

    for (const line of lines) {
      const match = line.match(regex);
      if (!match) {
        throw new Error(`Invalid log format at line: ${line}`);
      }

      const [, hash, author, date, message, refs, parents] = match;

      const refsArray = refs
        ? refs.split(', ').filter((ref) => ref.trim() !== '')
        : [];

      const parentsArray = parents
        ? parents.split(' ').filter((parent) => parent.trim() !== '')
        : [];

      const commit = {
        hash,
        author,
        date,
        message,
        refs: refsArray,
        parents: parentsArray,
      };

      commits.push(commit);
    }

    if (commits.length === 0) {
      throw new Error('No valid commits found in the input');
    }

    return commits;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IVisualizesGitLog>
  ) {
    try {
      VisualizeGitLogTool.parse(options.input.beforeOperationLog);
      VisualizeGitLogTool.parse(options.input.afterOperationLog);
    } catch (e: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Git log format error:\n${e.message}\n\nExpected format:\n<hash> (<author>) (<date>) (<message>) (<optional refs>) [<parents>]Format details:\n- <hash>: a short Git commit hash (hexadecimal, e.g., abc123f)\n- <date>: relative time (e.g., "2 days ago")\n- <optional refs>: comma-separated references like "HEAD, main" (optional; can be omitted)\n- <parent hashes>: space-separated commit hashes, surrounded by square brackets (e.g., [abc123])`
        ),
      ]);
    }

    const repos = WorkspaceManager.getInstance().getAvailableRepos();
    WebviewController.getInstance().sendMessage({
      type: 'getAvailableRepo',
      payload: {
        repos: repos.map((repo: any) => ({
          label: repo.label,
          description: repo.description,
          path: repo.path,
        })),
      },
    });

    VirtualRepoStateManager.getInstance().setLogs(
      options.input.beforeOperationLog,
      options.input.afterOperationLog
    );

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`Visualized log in the Git Log Viewer.`),
    ]);
  }
}
