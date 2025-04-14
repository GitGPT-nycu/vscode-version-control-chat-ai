import * as vscode from 'vscode';
import { WorkspaceManager } from '../WorkspaceManager';

interface ISetWorkspace {
    path: string;
}

export class SetWorkspaceTool implements vscode.LanguageModelTool<ISetWorkspace> {
    readonly name = 'set_workspace';

    async invoke(options: vscode.LanguageModelToolInvocationOptions<ISetWorkspace>) {
        const workspaceManager = WorkspaceManager.getInstance();
        const success = workspaceManager.setWorkspace(options.input.path);

        if (success) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Workspace set to: ${options.input.path}`)
            ]);
        } else {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Invalid workspace path: ${options.input.path}`)
            ]);
        }
    }
}