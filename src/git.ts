import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
const exec = promisify(execCb);

export async function getGitLogText(cwd: string): Promise<string | undefined> {

    // 檢查是否有 .git 資料夾
    const gitFolder = path.join(cwd, ".git");
    if (!fs.existsSync(gitFolder)) {
        vscode.window.showErrorMessage(`.git directory not found in ${cwd}`);
        return;
    }

    // 確認 Git 安裝
    try {
        const { stdout } = await exec("git --version");
        console.log(stdout);
    } catch {
        vscode.window.showErrorMessage("Git is not installed.");
        return;
    }

    try {
        const { stdout } = await exec(
            'git log -n 30 --all --pretty=format:"%h (%an) (%ar) (%s) %d [%p]"',
            { cwd }
        );
        return stdout;
    } catch (err: any) {
        vscode.window.showErrorMessage(err.stderr ?? "Git error");
        return;
    }
}
