import * as vscode from "vscode";
import { WebviewPanel } from '../WebviewPanel';

interface IVisualizesGitLog {
    before: string;
    after: string;
}

export class VisualizeGitLogTool implements vscode.LanguageModelTool<IVisualizesGitLog> {
    readonly name = 'visualize_git_log';

    constructor() { }

    async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<IVisualizesGitLog>) {
        return {
            invocationMessage: 'Visualizing mock Git log in Git Log Viewer',
            confirmationMessages: {
                title: 'Visualize Git Log Tree (AI-generated)',
                message: new vscode.MarkdownString(
                    `
                    Git Log (before):\n\n\`${options.input.before}\`
                    Git Log (after):\n\n\`${options.input.after}\`
                    `)
            }
        };
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<IVisualizesGitLog>) {
        WebviewPanel.getInstance().sendMessage({ type: 'showLog', log: options.input.after });

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Visualized AI-generated Git log in the Git Log Viewer.`)
        ]);
    }
}