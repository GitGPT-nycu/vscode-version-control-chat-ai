import * as vscode from "vscode";
import { getGitLogText } from "../git";
import { WebviewPanel } from "../webviewPanel";
import { WorkspaceManager } from "../WorkspaceManager";


export class OpenGitLogViewerTool implements vscode.LanguageModelTool<{}> {
    readonly name = 'open_git_log_viewer';

    async invoke() {
        let cwd: string;
        try {
            cwd = WorkspaceManager.getInstance().getCurrentWorkspace();
        } catch (e: any) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(e)
            ]);
        }

        const gitLog = await getGitLogText(cwd);

        WebviewPanel.getInstance().sendMessage({
            type: "git_log",
            gitLog
        });

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart("Git Log Viewer has been opened.")
        ]);

    }
}