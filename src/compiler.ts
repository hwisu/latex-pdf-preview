import { exec } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import { basename, extname, join } from 'path';
import { promisify } from 'util';
import { ExtensionContext, Uri, window, workspace } from 'vscode';

const execAsync = promisify(exec);

export class LaTeXCompiler {
    private outputChannel = window.createOutputChannel('LaTeX Preview');
    private tempDirCache = new Map<string, string>();

    constructor(private context: ExtensionContext) {}

    dispose = () => {
        this.outputChannel.dispose();
        this.tempDirCache.forEach(dir => existsSync(dir) && rmSync(dir, { recursive: true, force: true }));
    }

    async compile(documentUri: Uri): Promise<string> {
        const config = workspace.getConfiguration('latex-preview');
        const texPath = documentUri.fsPath;
        const texName = basename(texPath, extname(texPath));
        
        let tempDir = this.tempDirCache.get(texPath);
        if (!tempDir || !existsSync(tempDir)) {
            const storageUri = this.context.globalStorageUri;
            existsSync(storageUri.fsPath) || mkdirSync(storageUri.fsPath, { recursive: true });
            tempDir = join(storageUri.fsPath, `${texName}-${Date.now()}`);
            mkdirSync(tempDir, { recursive: true });
            this.tempDirCache.set(texPath, tempDir);
        }
        
        const tempTexPath = join(tempDir, basename(texPath));
        copyFileSync(texPath, tempTexPath);
        
        const pdfPath = join(tempDir, `${texName}.pdf`);
        const command = `cd "${tempDir}" && ${config.get<string>('executablePath') || 'pdflatex'} -interaction=nonstopmode "${tempTexPath}"`;

        this.outputChannel.clear();
        this.outputChannel.appendLine(`Compiling ${texPath}...`);

        try {
            await execAsync(command, { cwd: tempDir });
            
            const dir = tempDir; // TypeScript workaround
            ['.aux', '.log', '.out', '.toc', '.lof', '.lot', '.fls', '.fdb_latexmk', '.synctex.gz']
                .forEach(ext => {
                    const filePath = join(dir, texName + ext);
                    existsSync(filePath) && unlinkSync(filePath);
                });

            this.outputChannel.appendLine(`PDF saved at: ${pdfPath}`);
            return pdfPath;
        } catch (error) {
            this.outputChannel.appendLine(`Compilation failed: ${error}`);
            this.outputChannel.show();
            throw error;
        }
    }
}