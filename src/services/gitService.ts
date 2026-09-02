import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GitInfo } from '../models/project';

export class GitService {
  /**
   * Asynchronously inspects git status of a folder
   */
  public static async getGitInfo(folderPath: string): Promise<GitInfo> {
    if (!folderPath) {
      return { isGit: false };
    }

    try {
      if (!fs.existsSync(folderPath)) {
        return { isGit: false };
      }
    } catch {
      return { isGit: false };
    }

    return new Promise<GitInfo>((resolve) => {
      execFile(
        'git',
        ['status', '--porcelain=v1', '-b'],
        { cwd: folderPath, timeout: 3000 },
        (error: Error | null, stdout: string, _stderr: string) => {
          if (error) {
            // Either not a git repo or git is not available
            return resolve({ isGit: false });
          }

          try {
            const lines = stdout.split('\n').map((l: string) => l.trimEnd()).filter(Boolean);
            if (lines.length === 0) {
              return resolve({ isGit: true, clean: true, branch: 'unknown', modified: 0, untracked: 0 });
            }

            const headerLine = lines[0]; // e.g. "## main...origin/main [ahead 1, behind 2]" or "## main"
            let branch = 'HEAD';
            let ahead = 0;
            let behind = 0;

            if (headerLine.startsWith('## ')) {
              const branchPart = headerLine.substring(3);
              // Check ahead/behind
              const aheadMatch = branchPart.match(/ahead\s+(\d+)/);
              if (aheadMatch) {
                ahead = parseInt(aheadMatch[1], 10);
              }
              const behindMatch = branchPart.match(/behind\s+(\d+)/);
              if (behindMatch) {
                behind = parseInt(behindMatch[1], 10);
              }

              // Extract pure branch name before "..." or " "
              const branchNameOnly = branchPart.split('...')[0].split(' ')[0];
              branch = branchNameOnly || 'HEAD';
            }

            let modified = 0;
            let untracked = 0;

            for (let i = 1; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith('??')) {
                untracked++;
              } else {
                modified++;
              }
            }

            const clean = modified === 0 && untracked === 0;

            return resolve({
              isGit: true,
              branch,
              modified,
              untracked,
              ahead,
              behind,
              clean
            });
          } catch {
            return resolve({ isGit: false });
          }
        }
      );
    });
  }

  /**
   * Resolves GitInfo for a list of projects in parallel
   */
  public static async enrichProjectsWithGit(projects: { path: string }[]): Promise<Map<string, GitInfo>> {
    const gitMap = new Map<string, GitInfo>();
    const promises = projects.map(async (p) => {
      const gitInfo = await GitService.getGitInfo(p.path);
      gitMap.set(p.path, gitInfo);
    });

    await Promise.all(promises);
    return gitMap;
  }
}
