import * as vscode from "vscode";
import { getGitLogText } from "../git";
import { WorkspaceManager } from "../WorkspaceManager";

export class GetGitLogTool implements vscode.LanguageModelTool<{}> {
    readonly name = 'get_git_log';

    constructor(private workspaceManager: WorkspaceManager) { }

    async invoke(): Promise<vscode.LanguageModelToolResult> {
        let cwd: string;
        try {
            cwd = this.workspaceManager.getCurrentWorkspace();
        } catch {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart("No workspace set.")
            ]);
        }

        const log = await getGitLogText(cwd);
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(log ?? "Failed to get git log.")
        ]);
    }
}
