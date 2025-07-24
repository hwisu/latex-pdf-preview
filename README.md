# LaTeX Preview

Live LaTeX preview in VS Code.

## Features

- Real-time preview with auto-compilation
- Preserves LaTeX fonts and formatting
- Math equations via MathJax
- Multiple compiler support (make4ht, htlatex, pandoc)

## Requirements

- LaTeX distribution (TeX Live, MiKTeX, or MacTeX)
- HTML converter (`make4ht` recommended)

## Usage

Open `.tex` file → `Cmd/Ctrl+Shift+V`

## Settings

- `latex-preview.compiler`: Choose HTML converter (default: make4ht)
- `latex-preview.executablePath`: Custom LaTeX path
- `latex-preview.autoCompile`: Auto-compile on save