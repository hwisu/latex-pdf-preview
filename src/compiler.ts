import { execFile, ChildProcess, ExecFileException } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, unlinkSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { ExtensionContext, Uri, window, workspace } from 'vscode';

const ALLOWED_EXECUTABLES = ['pdflatex', 'xelatex', 'lualatex', 'latexmk'];

interface CompileSession {
  process: ChildProcess;
  sessionId: number;
  aborted: boolean;
}

export class LaTeXCompiler {
  private outputChannel = window.createOutputChannel('LaTeX Preview');
  private cacheDirPerWorkspace = new Map<string, string>();
  private compileSessions = new Map<string, CompileSession>();
  private lastInputHash = new Map<string, string>();
  private sessionCounter = 0;

  constructor(private context: ExtensionContext) {}

  dispose = () => {
    this.outputChannel.dispose();
    this.cacheDirPerWorkspace.forEach(dir => existsSync(dir) && rmSync(dir, { recursive: true, force: true }));
    this.compileSessions.forEach(session => {
      session.aborted = true;
      try { session.process.kill(); } catch { /* process may have already exited */ }
    });
    this.compileSessions.clear();
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
      const stat = statSync(texPath);
      return this.simpleHash(`${texPath}:${stat.size}:${stat.mtimeMs}`);
    } catch {
      return `${Date.now()}`;
    }
  }

  private validateExecutablePath(exePath: string): string {
    const exeName = basename(exePath).replace(/\.exe$/i, '');

    if (!ALLOWED_EXECUTABLES.includes(exeName)) {
      throw new Error(`Invalid LaTeX executable: ${exeName}. Allowed: ${ALLOWED_EXECUTABLES.join(', ')}`);
    }

    // Check for path traversal or injection attempts
    if (exePath.includes('..') || /[;&|`$]/.test(exePath)) {
      throw new Error('Invalid characters in executable path');
    }

    return exePath;
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

    // Cancel previous compilation session for this file
    const prevSession = this.compileSessions.get(texPath);
    if (prevSession) {
      prevSession.aborted = true;
      try { prevSession.process.kill(); } catch { /* process may have already exited */ }
      this.compileSessions.delete(texPath);
    }

    // Validate and get executable path
    const configExePath = config.get<string>('executablePath') || 'pdflatex';
    const exePath = this.validateExecutablePath(configExePath);

    // Build arguments array (no shell interpolation)
    const args = [
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-file-line-error',
      tempTexPath
    ];

    this.outputChannel.clear();
    this.outputChannel.appendLine(`Compiling ${texPath}...`);

    const sessionId = ++this.sessionCounter;

    return new Promise<string>((resolve, reject) => {
      const proc = execFile(exePath, args, { cwd: workDir }, (err: ExecFileException | null, stdout: string, stderr: string) => {
        // Get the current session to check if it was aborted
        const currentSession = this.compileSessions.get(texPath);

        // Ignore callback if session was aborted or replaced
        if (!currentSession || currentSession.sessionId !== sessionId || currentSession.aborted) {
          return;
        }

        this.compileSessions.delete(texPath);

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

        // Clean up auxiliary files
        ['.aux', '.log', '.out', '.toc', '.lof', '.lot', '.fls', '.fdb_latexmk', '.synctex.gz']
          .forEach(ext => {
            const filePath = join(workDir, texName + ext);
            existsSync(filePath) && unlinkSync(filePath);
          });

        this.lastInputHash.set(texPath, currentHash);
        this.outputChannel.appendLine(`PDF saved at: ${pdfPath}`);
        resolve(pdfPath);
      });

      // Store session with metadata
      this.compileSessions.set(texPath, {
        process: proc,
        sessionId,
        aborted: false
      });
    });
  }
}
