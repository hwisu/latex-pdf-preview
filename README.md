# LaTeX PDF Preview

Live PDF preview for LaTeX documents in VS Code.

## Features

- Real-time PDF preview - Auto-compiles on save
- Lightweight - No bundled PDF renderer (~36KB package)
- Uses VSCode's native PDF viewing

## Requirements

- LaTeX distribution (pdflatex, xelatex, lualatex, or latexmk)
- PDF viewer extension for VSCode (e.g., [vscode-pdf](https://marketplace.visualstudio.com/items?itemName=tomoki1207.pdf))

```bash
# macOS
brew install --cask mactex    # or basictex

# Windows/Linux
# Install TeX Live or MiKTeX
```

## Usage

1. Open `.tex` file
2. Click preview icon or use Command Palette
3. Edit and save - preview updates automatically

## Commands

- `LaTeX: Show Preview` - Open PDF preview
- `LaTeX: Refresh Preview` - Manual refresh

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `latex-preview.executablePath` | `""` | Custom LaTeX executable path |
| `latex-preview.autoCompile` | `true` | Auto-compile on save |
| `latex-preview.debounceDelay` | `300` | Debounce delay (ms) |
| `latex-preview.throttleDelay` | `2000` | Throttle delay (ms) |

## License

MIT
