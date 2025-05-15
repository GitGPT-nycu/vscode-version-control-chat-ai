import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import { VIRTUAL_REPO_PATH } from './common/constants';
import { VirtualRepoStateManager } from './VirtualRepoStateManager';

const exec = promisify(execCb);

/**`
 * 從實體 Git repository 中取得格式化後的 Git log（最多 30 筆），格式與 visualize_git_log 工具一致。
 * 若遇到錯誤（如未安裝 Git、不是 Git 專案），會顯示錯誤訊息並回傳 undefined。
 *
 * @param repoPath Git repository 的根目錄（如 /Users/me/myproject）
 * @returns 成功則回傳 Git log 字串；失敗則回傳 undefined
 */
export async function getRawGitLogFromRepo(
  repoPath: string
): Promise<string | undefined> {
  const gitFolder = path.join(repoPath, '.git');

  if (!fs.existsSync(gitFolder)) {
    vscode.window.showErrorMessage(`.git directory not found in ${repoPath}`);
    return;
  }

  try {
    await exec('git --version');
  } catch {
    vscode.window.showErrorMessage('Git is not installed.');
    return;
  }

  try {
    const { stdout } = await exec(
      'git log -n 30 --all --pretty=format:"%h (%an) (%ar) (%s) %d [%p]"',
      { cwd: repoPath }
    );
    return stdout;
  } catch (err: any) {
    vscode.window.showErrorMessage(err.stderr ?? 'Git error');
    return;
  }
}

/**
 * 根據 repo 路徑決定要回傳哪種 Git log：
 * - 如果是虛擬 repo（VIRTUAL_REPO_PATH），則從 VirtualRepoStateManager 取得 before/after logs。
 * - 如果是實體 repo，則呼叫 getRawGitLogFromRepo 取得 before log，after 為空字串。
 *
 * @param repoPath 可以是實體路徑或 VIRTUAL_REPO_PATH
 * @returns 若成功取得，回傳 `{ before, after }`；若失敗（如非 git repo），回傳 null
 */
export async function resolveEffectiveGitLogs(
  repoPath: string
): Promise<{ before: string; after: string } | null> {
  if (repoPath === VIRTUAL_REPO_PATH) {
    return VirtualRepoStateManager.getInstance().getLogs();
  }

  const gitLog = await getRawGitLogFromRepo(repoPath);

  return {
    before: gitLog ?? '',
    after: '',
  };
}
