# LaTeX HTML Preview

Live LaTeX preview in VS Code with high-quality HTML conversion.

## Features

- **Real-time preview** with auto-compilation
- **PDF-to-HTML conversion** for superior quality
- **Multiple viewing options**: VS Code preview panel, VS Code editor, or external browser
- **Preserves LaTeX fonts and formatting**
- **Math equations** via MathJax
- **Multiple compiler support**: pdflatex, xelatex, make4ht, htlatex, pandoc

## Requirements

### macOS Installation

```bash
# Install LaTeX (choose one)
brew install --cask mactex        # Full distribution (4GB)
brew install --cask basictex      # Minimal distribution (90MB)

# Install pandoc (REQUIRED for default PDF→HTML conversion)
brew install pandoc

# Optional: Install poppler for alternative pdftohtml
brew install poppler
```

### Other Platforms

- **Windows**: Install [MiKTeX](https://miktex.org/) and [Pandoc](https://pandoc.org/)
- **Linux**: Install TeX Live and pandoc via your package manager

## Usage

1. Open any `.tex` file
2. Use one of these commands:
   - `Cmd/Ctrl+Shift+V` - Open preview panel
   - `Cmd/Ctrl+Shift+P` → "LaTeX: Open HTML in VS Code" - View raw HTML
   - `Cmd/Ctrl+Shift+P` → "LaTeX: Open HTML in Browser" - Open in browser

## Commands

- **LaTeX: Show Preview** - Opens preview in side panel
- **LaTeX: Refresh Preview** - Manually refresh the preview
- **LaTeX: Open HTML in VS Code** - Opens generated HTML in editor (no extra CSS)
- **LaTeX: Open HTML in Browser** - Opens HTML in default browser

## Settings

- `latex-preview.compiler`: Choose compiler (default: `pdflatex`)
  - `pdflatex`: Best for most documents (uses PDF→HTML)
  - `xelatex`: Better for custom fonts
  - `make4ht`: Direct LaTeX→HTML conversion
  - `htlatex`: Classic converter
  - `pdflatex+pdftohtml`: Alternative PDF→HTML
- `latex-preview.executablePath`: Custom LaTeX executable path
- `latex-preview.autoCompile`: Auto-compile on save (default: true)
- `latex-preview.cleanAuxFiles`: Clean auxiliary files after compilation

## Shell Scripts

The extension includes shell scripts for command-line usage:

```bash
# Direct LaTeX to HTML conversion
./tex2html.sh input.tex

# PDF-based conversion (best quality)
./tex2html-pdf.sh input.tex --method=pandoc
```

## Troubleshooting

### "Command not found" errors
Make sure LaTeX and pandoc are in your PATH:
```bash
which pdflatex
which pandoc
```

### Poor HTML quality
Try the PDF-based conversion by setting compiler to `pdflatex` (default).

### Missing fonts in preview
The extension uses web fonts to approximate LaTeX fonts. For exact fonts, use "Open HTML in Browser" command.

## License

MIT