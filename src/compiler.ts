import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);

export class LaTeXCompiler {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('LaTeX Preview');
    }

    async compile(documentUri: vscode.Uri): Promise<string> {
        const config = vscode.workspace.getConfiguration('latex-preview');
        const compiler = config.get<string>('compiler', 'make4ht');
        const executablePath = config.get<string>('executablePath', '');
        const cleanAuxFiles = config.get<boolean>('cleanAuxFiles', true);

        const texPath = documentUri.fsPath;
        const texDir = path.dirname(texPath);
        const texName = path.basename(texPath, path.extname(texPath));
        
        // Create temp directory for output
        const tempDir = path.join(os.tmpdir(), 'latex-preview', Date.now().toString());
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Copy tex file to temp directory to avoid cluttering source directory
        const tempTexPath = path.join(tempDir, path.basename(texPath));
        fs.copyFileSync(texPath, tempTexPath);
        
        // Create custom config file for better font handling
        const configContent = this.getConfigContent(compiler);
        if (configContent) {
            const configPath = path.join(tempDir, 'myconfig.cfg');
            fs.writeFileSync(configPath, configContent);
        }
        
        const htmlPath = path.join(tempDir, `${texName}.html`);

        const command = this.buildCommand(compiler, executablePath, tempTexPath, tempDir);

        this.outputChannel.clear();
        this.outputChannel.appendLine(`Compiling ${texPath} with ${compiler}...`);
        this.outputChannel.appendLine(`Command: ${command}`);

        try {
            const { stdout, stderr } = await execAsync(command, { cwd: tempDir });
            
            if (stdout) {
                this.outputChannel.appendLine(stdout);
            }
            if (stderr) {
                this.outputChannel.appendLine(stderr);
            }

            if (!fs.existsSync(htmlPath)) {
                throw new Error('HTML file was not generated');
            }

            // Post-process HTML to ensure proper font handling
            let htmlContent = fs.readFileSync(htmlPath, 'utf8');
            htmlContent = this.postProcessHtml(htmlContent);
            fs.writeFileSync(htmlPath, htmlContent);

            if (cleanAuxFiles) {
                await this.cleanAuxiliaryFiles(tempDir, texName);
            }

            this.outputChannel.appendLine('Compilation successful!');
            return htmlPath;
        } catch (error) {
            this.outputChannel.appendLine(`Compilation failed: ${error}`);
            this.outputChannel.show();
            throw error;
        }
    }

    private getConfigContent(compiler: string): string | null {
        if (compiler === 'make4ht' || compiler === 'htlatex') {
            return `\\Preamble{xhtml}
\\Configure{VERSION}{}
\\Configure{DOCTYPE}{\\HCode{<!DOCTYPE html>\\Hnewline}}
\\Configure{HTML}{\\HCode{<html>\\Hnewline}}{\\HCode{\\Hnewline</html>}}
\\Configure{@HEAD}{\\HCode{<meta charset="UTF-8" />\\Hnewline}}
\\Configure{@HEAD}{\\HCode{<meta name="viewport" content="width=device-width, initial-scale=1.0" />\\Hnewline}}
\\Css{
  body { 
    font-family: "Latin Modern Roman", "Computer Modern", Georgia, serif;
  }
  .center { text-align: center !important; }
  .center * { text-align: center !important; }
  div.center { text-align: center !important; }
  div.center p { text-align: center !important; }
}
\\begin{document}`;
        }
        return null;
    }

    private postProcessHtml(html: string): string {
        // Add web fonts for better typography
        const fontLinks = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Computer+Modern+Serif:wght@400;700&display=swap" rel="stylesheet">
    <style>
        @font-face {
            font-family: 'Latin Modern Roman';
            src: url('https://cdn.jsdelivr.net/gh/aaaakshat/cm-web-fonts@latest/fonts/lmroman10-regular.woff') format('woff');
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: 'Latin Modern Roman';
            src: url('https://cdn.jsdelivr.net/gh/aaaakshat/cm-web-fonts@latest/fonts/lmroman10-bold.woff') format('woff');
            font-weight: bold;
            font-style: normal;
        }
        @font-face {
            font-family: 'Latin Modern Roman';
            src: url('https://cdn.jsdelivr.net/gh/aaaakshat/cm-web-fonts@latest/fonts/lmroman10-italic.woff') format('woff');
            font-weight: normal;
            font-style: italic;
        }
        body {
            font-family: 'Latin Modern Roman', 'Computer Modern Serif', Georgia, serif !important;
        }
        /* Preserve LaTeX table layouts */
        table { border-collapse: collapse; }
        td { vertical-align: top; }
        /* LaTeX standard sizes */
        .LARGE { font-size: 1.7em !important; }
        .Large { font-size: 1.44em !important; }
        .large { font-size: 1.2em !important; }
        .normalsize { font-size: 1em !important; }
        .small { font-size: 0.9em !important; }
        .footnotesize { font-size: 0.8em !important; }
        .scriptsize { font-size: 0.7em !important; }
        .tiny { font-size: 0.5em !important; }
    </style>
</head>`;
        
        html = html.replace('</head>', fontLinks);
        
        // Fix LaTeX size commands and styles
        html = html.replace(/<span class="LARGE">/g, '<span style="font-size: 1.7em;">');
        html = html.replace(/<span class="Large">/g, '<span style="font-size: 1.44em;">');
        html = html.replace(/<span class="large">/g, '<span style="font-size: 1.2em;">');
        html = html.replace(/<span class="small">/g, '<span style="font-size: 0.9em;">');
        html = html.replace(/<span class="bfseries">/g, '<span style="font-weight: bold;">');
        
        // Ensure section headers have proper sizing
        html = html.replace(/<h2/g, '<h2 style="font-size: 1.5em; margin-top: 1.5em; margin-bottom: 0.5em;"');
        html = html.replace(/<h3/g, '<h3 style="font-size: 1.3em; margin-top: 1.2em; margin-bottom: 0.4em;"');
        html = html.replace(/<h4/g, '<h4 style="font-size: 1.1em; margin-top: 1em; margin-bottom: 0.3em;"');
        
        return html;
    }

    private buildCommand(compiler: string, executablePath: string, texPath: string, outputDir: string): string {
        const compilerPath = executablePath || compiler;
        const texName = path.basename(texPath, '.tex');
        
        switch (compiler) {
            case 'htlatex':
                // htlatex with custom config
                return `cd "${outputDir}" && ${compilerPath} "${texPath}" "myconfig,html,mathml,charset=utf-8,fn-in" " -cmozhtf" "" "-interaction=nonstopmode"`;
            
            case 'make4ht':
                // make4ht with inline CSS for better isolation
                return `cd "${outputDir}" && ${compilerPath} "${texPath}" "myconfig,html5,mathml,mathjax,charset=utf-8,css-in" "-interaction=nonstopmode" "-c myconfig"`;
            
            case 'latex2html':
                return `cd "${outputDir}" && ${compilerPath} -no_navigation -no_footnode -split 0 -info 0 "${texPath}"`;
            
            case 'pandoc':
                // Pandoc with custom CSS
                return `cd "${outputDir}" && ${compilerPath} -f latex -t html5 --standalone --mathjax --metadata title="LaTeX Preview" --css-include=custom.css -o "${texName}.html" "${texPath}"`;
            
            default:
                // Default to make4ht for best results
                return `cd "${outputDir}" && make4ht "${texPath}" "myconfig,html5,mathml,mathjax,charset=utf-8,fn-in" "-interaction=nonstopmode"`;
        }
    }

    private async cleanAuxiliaryFiles(dir: string, baseName: string): Promise<void> {
        const extensions = ['.aux', '.log', '.out', '.toc', '.lof', '.lot', '.fls', '.fdb_latexmk', '.synctex.gz', '.4ct', '.4tc', '.dvi', '.idv', '.lg', '.tmp', '.xref', '.css'];
        
        for (const ext of extensions) {
            const filePath = path.join(dir, baseName + ext);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                console.error(`Failed to delete ${filePath}: ${error}`);
            }
        }
        
        // Also clean config file
        const configPath = path.join(dir, 'myconfig.cfg');
        try {
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }
        } catch (error) {
            console.error(`Failed to delete config: ${error}`);
        }
    }
}