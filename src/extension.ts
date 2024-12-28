import * as vscode from "vscode";
import { Flow } from "./git-llm"
import { exec } from 'child_process';
import { WebviewPanel } from './webviewPanel';

const terminalName = "WebView Terminal";

export function activate(context: vscode.ExtensionContext) {
    let queryLLM = vscode.commands.registerCommand(
        'llm-interaction.queryLLM',
        async () => {
            const cwd = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? (() => { throw new Error('No workspace folder is open.'); })();

            vscode.window.showInformationMessage(`workspace: ${cwd}`);

            exec('git status', { encoding: 'buffer', cwd: cwd }, (error, stdout, stderr) => {
                if (error) {
                    throw new Error('Git is not installed or not in PATH.');
                }
                const output = stdout.toString('utf8');
                vscode.window.showInformationMessage(`Git version:\n${output}`);
            })
        }
    );

    let openWebView = vscode.commands.registerCommand(
        "webview-api.openWebView",
        () => {
            try {
                const webviewPanel = WebviewPanel.getInstance(context);
                const cwd = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? (() => { throw new Error('No workspace folder is open.'); })();

                webviewPanel.onDidReceiveMessage((message) => {
                    if (message.type === "task") {
                        const flow = new Flow(cwd, message.task, webviewPanel);
                        flow.run();
                    }
                });
            } catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                } else {
                    vscode.window.showErrorMessage(`Unknown error occurred.`);
                }
                console.log(error);
            }
        }
    );

    context.subscriptions.push(queryLLM, openWebView);
}

export function deactivate() { }
