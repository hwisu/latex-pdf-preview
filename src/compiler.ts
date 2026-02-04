import { execFile, ChildProcess, ExecFileException } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, unlinkSync } from 'fs';
import { platform, tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { ExtensionContext, Uri, window, workspace } from 'vscode';

const ALLOWED_EXECUTABLES = ['pdflatex', 'xelatex', 'lualatex', 'latexmk'];

function getCacheBaseDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || tmpdir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Caches', 'latex-pdf-preview');
    case 'win32':
      return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'latex-pdf-preview', 'cache');
    default: // linux and others
      return join(process.env.XDG_CACHE_HOME || join(home, '.cache'), 'latex-pdf-preview');
  }
}

interface CompileSession {
  process: ChildProcess;
  sessionId: number;
  aborted: boolean;
}

export class LaTeXCompiler {
  private outputChannel = window.createOutputChannel('LaTeX Preview');
  private cacheDir: string;
  private compileSessions = new Map<string, CompileSession>();
  private lastInputHash = new Map<string, string>();
  private sessionCounter = 0;

  constructor(private context: ExtensionContext) {
    this.cacheDir = getCacheBaseDir();
    existsSync(this.cacheDir) || mkdirSync(this.cacheDir, { recursive: true });
  }

  dispose = () => {
    this.outputChannel.dispose();
    // Clean up cache directory on dispose
    if (existsSync(this.cacheDir)) {
      rmSync(this.cacheDir, { recursive: true, force: true });
    }
    this.compileSessions.forEach(session => {
      session.aborted = true;
      try { session.process.kill(); } catch { /* process may have already exited */ }
    });
    this.compileSessions.clear();
  };

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

    // Use hash of full path to avoid collisions between same-named files
    const pathHash = this.simpleHash(texPath);
    const workDir = join(this.cacheDir, `${texName}-${pathHash}`);
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
