/**
 * VirtualRepoStateManager 是一個專門管理虛擬 Git Repo 狀態的類別。
 * 它記錄操作前與操作後的 Git log 並允許外部訂閱變更事件。
 */

export class VirtualRepoStateManager {
  private static instance: VirtualRepoStateManager;

  private beforeOperationLog: string = '';
  private afterOperationLog: string = '';

  // 訂閱者清單：當 log 更新時會通知這些 listener
  private listeners: ((logs: { before: string; after: string }) => void)[] = [];

  private constructor() {}

  /**
   * 初始化 Singleton 實例
   */
  public static init() {
    if (!VirtualRepoStateManager.instance) {
      VirtualRepoStateManager.instance = new VirtualRepoStateManager();
    }
  }

  /**
   * 取得 Singleton 實例，若尚未初始化會丟出錯誤
   */
  public static getInstance(): VirtualRepoStateManager {
    if (!VirtualRepoStateManager.instance) {
      throw new Error(
        'VirtualRepoStateManager has not been initialized. Call VirtualRepoStateManager.init() first.'
      );
    }
    return VirtualRepoStateManager.instance;
  }

  /**
   * 設定兩個 log
   */
  public setLogs(beforeOperationLog: string, afterOperationLog: string) {
    this.beforeOperationLog = beforeOperationLog;
    this.afterOperationLog = afterOperationLog;
    this.notifyListeners();
  }

  /**
   * 取得目前的 log 狀態
   */
  public getLogs(): { before: string; after: string } {
    return {
      before: this.beforeOperationLog,
      after: this.afterOperationLog,
    };
  }

  /**
   * 訂閱 log 變更事件
   * @param callback 每次變更時會被呼叫，提供最新的 before/after log
   */
  public onChange(
    callback: (logs: { before: string; after: string }) => void
  ): void {
    this.listeners.push(callback);
  }

  /**
   * 通知所有訂閱者 log 發生變更
   */
  private notifyListeners(): void {
    const logs = this.getLogs();
    for (const listener of this.listeners) {
      listener(logs);
    }
  }

  /**
   * 清除目前所有的 log 狀態（重置）
   */
  public clear(): void {
    this.beforeOperationLog = '';
    this.afterOperationLog = '';
    this.notifyListeners();
  }
}
