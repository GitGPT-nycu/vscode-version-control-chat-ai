import * as vscode from 'vscode';
import { WebviewController } from '../WebviewController';

interface IHighlightCommit {
  hash: string;
}

export class HightlightCommitTool
  implements vscode.LanguageModelTool<IHighlightCommit>
{
  readonly name = 'highlight_commit';

  constructor() {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IHighlightCommit>
  ) {
    const hash = options.input.hash;
    if (!hash) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Missing commit hash.'),
      ]);
    }

    WebviewController.getInstance().sendMessage({
      type: 'hightlightCommit',
      payload: {
        hash: hash,
      },
    });

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        `Commit ${hash} has been highlighted in the Git log tree.`
      ),
    ]);
  }
}
