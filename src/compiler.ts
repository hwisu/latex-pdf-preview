import { exec, ChildProcess } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { promisify } from 'util';
import { ExtensionContext, Uri, window, workspace } from 'vscode';

const execAsync = promisify(exec);

export class LaTeXCompiler {
  private outputChannel = window.createOutputChannel('LaTeX Preview');
  private cacheDirPerWorkspace = new Map<string, string>();
  private inflight = new Map<string, ChildProcess>();
  private lastInputHash = new Map<string, string>();

  constructor(private context: ExtensionContext) {}

  dispose = () => {
    this.outputChannel.dispose();
    this.cacheDirPerWorkspace.forEach(dir => existsSync(dir) && rmSync(dir, { recursive: true, force: true }));
    this.inflight.forEach(p => { try { p.kill(); } catch {} });
    this.inflight.clear();
  };

  private getWorkspaceFolderPath(uri: Uri): string {
    const folder = workspace.getWorkspaceFolder(uri);
    return folder ? folder.uri.fsPath : dirname(uri.fsPath);
  }

  private ensureCacheDir(workspacePath: string): string {
    let dir = this.cacheDirPerWorkspace.get(workspacePath);
    if (!dir) {
      dir = join(workspacePath, '.latex-preview-cache');
      existsSync(dir) || mkdirSync(dir, { recursive: true });
      this.cacheDirPerWorkspace.set(workspacePath, dir);
    }
    return dir;
  }

  private simpleHash(input: string): string {
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    return `${h >>> 0}`;
  }

  private computeInputHash(texPath: string): string {
    try {
      const stat = require('fs').statSync(texPath);
      return this.simpleHash(`${texPath}:${stat.size}:${stat.mtimeMs}`);
    } catch {
      return `${Date.now()}`;
    }
  }

  async compile(documentUri: Uri): Promise<string> {
    const config = workspace.getConfiguration('latex-preview');
    const texPath = documentUri.fsPath;
    const texName = basename(texPath, extname(texPath));

    const workspacePath = this.getWorkspaceFolderPath(documentUri);
    const cacheDir = this.ensureCacheDir(workspacePath);
    const workDir = join(cacheDir, texName);
    existsSync(workDir) || mkdirSync(workDir, { recursive: true });

    const tempTexPath = join(workDir, basename(texPath));
    copyFileSync(texPath, tempTexPath);

    const pdfPath = join(workDir, `${texName}.pdf`);

    const currentHash = this.computeInputHash(texPath);
    if (this.lastInputHash.get(texPath) === currentHash && existsSync(pdfPath)) {
      return pdfPath;
    }

    const prev = this.inflight.get(texPath);
    if (prev) {
      try { prev.kill(); } catch {}
      this.inflight.delete(texPath);
    }

    const exePath = config.get<string>('executablePath') || 'pdflatex';
    const exe = exePath.includes(' ') ? `"${exePath}"` : exePath;
    const args = `-interaction=nonstopmode -halt-on-error -file-line-error`;
    const command = `${exe} ${args} "${tempTexPath}"`;

    this.outputChannel.clear();
    this.outputChannel.appendLine(`Compiling ${texPath}...`);

    return new Promise<string>((resolve, reject) => {
      const proc = require('child_process').exec(command, { cwd: workDir }, (err: any, stdout: string, stderr: string) => {
        this.inflight.delete(texPath);
        if (err) {
          this.outputChannel.appendLine(`Compilation failed: ${err}`);
          if (stdout) {
            this.outputChannel.appendLine('--- stdout ---');
            this.outputChannel.appendLine(stdout);
          }
          if (stderr) {
            this.outputChannel.appendLine('--- stderr ---');
            this.outputChannel.appendLine(stderr);
          }
          this.outputChannel.show();
          reject(err);
          return;
        }
        ['.aux', '.log', '.out', '.toc', '.lof', '.lot', '.fls', '.fdb_latexmk', '.synctex.gz']
          .forEach(ext => {
            const filePath = join(workDir, texName + ext);
            existsSync(filePath) && unlinkSync(filePath);
          });
        this.lastInputHash.set(texPath, currentHash);
        this.outputChannel.appendLine(`PDF saved at: ${pdfPath}`);
        resolve(pdfPath);
      });
      this.inflight.set(texPath, proc);
    });
  }
}
