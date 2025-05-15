import * as vscode from 'vscode';
import * as path from 'path';
import { VIRTUAL_REPO_PATH } from './common/constants';
import { VirtualRepoStateManager } from './VirtualRepoStateManager';

export interface RepoEntry {
  label: string;
  description: string;
  path: string;
}

/**
 * WorkspaceManager 負責管理目前使用中的 Git 存放庫，
 * 包含自動/手動切換 repo、狀態顯示邏輯由外部傳入 callback 控制。
 */
export class WorkspaceManager {
  // Singleton 實例：確保全域僅有一個 WorkspaceManager
  private static instance: WorkspaceManager;

  // 目前選定的 Git 存放庫路徑，null 表示尚未選定`
  private currentRepoPath: string | null = null;

  // 是否啟用自動模式（根據目前開啟的檔案自動切換 repo）
  private isAutoMode: boolean = true;

  // VSCode Git API 實例，用來存取已開啟的 Git repository
  private gitAPI: any;

  private virtualRepoManager: VirtualRepoStateManager;
  private readonly virtualRepoLabel = '[Virtual] GitGPT Agent';

  private readonly _onRepoChanged = new vscode.EventEmitter<string | null>();
  private readonly _onRepoRegistered = new vscode.EventEmitter<string>();
  public readonly onRepoChanged = this._onRepoChanged.event;
  public readonly onRepoRegistered = this._onRepoRegistered.event;

  /**
   * 建構子 - 初始化 Git API、註冊 repo 事件、根據目前檔案選擇 repo
   * @param onRepoChange 當 repo 發生變化時觸發的 callback
   */
  private constructor() {
    // 當 virtualRepo 狀態改變時，通知外部
    this.virtualRepoManager = VirtualRepoStateManager.getInstance();

    this.virtualRepoManager.onChange(() => {
      this._onRepoChanged.fire(VIRTUAL_REPO_PATH);
    });

    // 取得 Git 擴充功能的 API
    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    this.gitAPI = gitExtension?.getAPI(1);

    if (!this.gitAPI) {
      vscode.window.showErrorMessage('無法取得 vscode.git 擴充功能');
      return;
    }

    // 當有新的 Git repo 被開啟時註冊變動事件
    this.gitAPI.onDidOpenRepository((repo: any) => {
      console.log(`onDidOpenRepository: ${repo.rootUri.fsPath}`);

      this._onRepoRegistered.fire(repo.rootUri.fsPath);

      // 如果目前是手動模式，且當前 repo 是選定的 repo，就更新狀態列
      repo.state.onDidChange(() => {
        if (!this.isAutoMode && this.currentRepoPath === repo.rootUri.fsPath) {
          this.updateStatus(repo.rootUri.fsPath);
        }
      });

      const isSubPath = (filePath: string, basePath: string): boolean => {
        const rel = path.relative(basePath, filePath);
        return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
      };

      // 初始化 currentRepoPath
      const uri = vscode.window.activeTextEditor?.document?.uri;
      if (!uri && !this.currentRepoPath) {
        // 如果沒有開啟檔案，default 設置為第一個 git repo
        this.updateStatus(repo.rootUri.fsPath);
      } else if (uri && isSubPath(uri.fsPath, repo.rootUri.fsPath)) {
        const detectedRepo = this.gitAPI.getRepository(uri);
        const finalRepoPath =
          detectedRepo?.rootUri?.fsPath ?? repo.rootUri.fsPath;
        this.updateStatus(finalRepoPath);
      }
    });

    // 使用者切換編輯器時，在自動模式下更新狀態列
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document?.uri) {
        this.updateStatusAuto(editor.document.uri);
      }
    });

    this.setSelectedRepo('__auto__');
  }

  /**
   * 初始化 Singleton 實例
   * @param onRepoChange repo 切換時要觸發的 callback
   */
  public static init() {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
  }

  /**
   * 取得 GitAPI
   */
  public getGitAPI(): any {
    return this.gitAPI;
  }

  /**
   * 取得 Singleton 實例，若尚未初始化會丟出錯誤
   */
  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      throw new Error(
        'WorkspaceManager has not been initialized. Call WorkspaceManager.init() first.'
      );
    }
    return WorkspaceManager.instance;
  }

  /**
   * 取得目前選定的 Git repo 路徑，若未選定會丟出錯誤
   */
  public getCurrentRepoPath(): string {
    if (!this.currentRepoPath) {
      throw new Error('No workspace folder is set.');
    }
    return this.currentRepoPath;
  }

  /**
   * 更新當前 repo 狀態與回傳通知
   * @param repoPath repo 的唯一識別（path）
   */
  public updateStatus(repoPath: string) {
    this.currentRepoPath = repoPath;
    this._onRepoChanged.fire(this.currentRepoPath);
  }

  /**
   * 自動模式：依據當前檔案 uri 判斷其所屬 repo 並觸發狀態更新
   * @param fileUri 使用者當前開啟的檔案 uri
   */
  public updateStatusAuto(fileUri: vscode.Uri) {
    if (!this.isAutoMode) {
      return;
    }

    const repo = this.gitAPI.getRepository(fileUri);

    // 僅當有偵測到 repo 時才更新
    if (repo?.rootUri?.fsPath) {
      this.updateStatus(repo.rootUri.fsPath);
    }
  }

  /**
   * 手動設定目前選擇的 repo 或切換為自動模式
   * @param path 選擇的 repo path，或特殊值 '__auto__'
   */
  public setSelectedRepo(path: string) {
    if (path === '__auto__') {
      this.isAutoMode = true;
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        this.updateStatusAuto(editor.document.uri);
      }
    } else {
      this.isAutoMode = false;
      this.updateStatus(path);
    }
  }

  /**
   * 取得所有可選擇的 Git repo 清單（含 Auto 與虛擬 repo）
   */
  public getAvailableRepos(): RepoEntry[] {
    const repos: RepoEntry[] = this.gitAPI.repositories.map((repo: any) => ({
      label: path.basename(repo.rootUri.fsPath),
      description: repo.rootUri.fsPath,
      path: repo.rootUri.fsPath,
    }));

    // 加入虛擬 repo 條目
    repos.push({
      label: this.virtualRepoLabel,
      description: 'A virtual GitGPT agent repo with no real file system',
      path: VIRTUAL_REPO_PATH,
    });

    // 在最前面加入 Auto 模式選項
    return [
      {
        label: 'Auto',
        description: 'Automatically switch according to the current file',
        path: '__auto__',
      },
      ...repos,
    ];
  }
}
