import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * WorkspaceManager 負責管理當前的工作區資料夾狀態，
 * 提供設定與取得 workspace 的能力，並顯示在 VSCode 的狀態列上。
 */
export class WorkspaceManager {
    // 靜態實例，用於實現 Singleton 模式。
    private static instance: WorkspaceManager;

    // 當前選擇的 workspace 路徑
    private currentWorkspace: string | undefined;

    // 狀態列物件（左下角）
    private statusBarItem: vscode.StatusBarItem;

    /**
     * 私有建構子，僅能透過 init() 初始化一次。
     * @param context VSCode Extension 上下文
     */
    private constructor(context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = "gitgpt.selectWorkspace";
        this.currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        this.updateStatusBarItem();

        context.subscriptions.push(this.statusBarItem);
    }

    /**
     * 初始化 WorkspaceManager 實例，應於 activate() 中呼叫一次。
     * @param context VSCode Extension 上下文
     */
    public static init(context: vscode.ExtensionContext) {
        if (!WorkspaceManager.instance) {
            WorkspaceManager.instance = new WorkspaceManager(context);
        }
    }

    /**
     * 取得 Singleton 實例。若尚未初始化則丟出錯誤。
     * @returns WorkspaceManager 的實例
     */
    public static getInstance(): WorkspaceManager {
        if (!WorkspaceManager.instance) {
            throw new Error("WorkspaceManager has not been initialized. Call WorkspaceManager.init(context) first.");
        }
        return WorkspaceManager.instance;
    }

    /**
     * 彈出選擇資料夾對話框，供使用者選擇工作區。
     * @returns 選取的資料夾路徑（或 undefined）
     */
    public async selectWorkspaceFolder(): Promise<string | undefined> {
        const folderUri = await vscode.window.showOpenDialog({
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: "select folder",
        });

        return folderUri?.[0]?.fsPath;
    }

    /**
     * 設定當前 workspace，並更新狀態列。
     * @param folderPath 要設定的資料夾路徑
     * @returns 是否設定成功
     */
    public setWorkspace(folderPath: string): boolean {
        if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
            this.currentWorkspace = folderPath;
            this.updateStatusBarItem();
            return true;
        }
        return false;
    }

    /**
     * 取得目前設定的 workspace 路徑。
     * 若尚未設定則丟出錯誤。
     * @returns 當前 workspace 路徑
     */
    public getCurrentWorkspace(): string {
        if (!this.currentWorkspace) {
            throw new Error("No workspace folder is set.");
        }
        return this.currentWorkspace;
    }

    /**
     * 更新 VSCode 狀態列中顯示的 workspace 名稱與提示。
     */
    private updateStatusBarItem() {
        if (this.currentWorkspace) {
            const folderName = path.basename(this.currentWorkspace);
            this.statusBarItem.text = `$(folder) ${folderName}`;
            this.statusBarItem.tooltip = this.currentWorkspace;
        } else {
            this.statusBarItem.text = `$(folder) No Workspace`;
            this.statusBarItem.tooltip = "No workspace folder selected";
        }
        this.statusBarItem.show();
    }
}
