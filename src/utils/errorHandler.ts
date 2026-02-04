import { window } from 'vscode';

export interface CompilationError {
  message: string;
  code?: string;
  killed?: boolean;
}

export function handleCompilationError(error: unknown, context: 'compile' | 'refresh' | 'watch'): void {
  const errorMessage = extractErrorMessage(error);
  const userMessage = formatUserMessage(errorMessage, context);

  window.showErrorMessage(userMessage);
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('ENOENT')) {
      return 'LaTeX compiler not found. Please install a LaTeX distribution (e.g., TeX Live, MiKTeX) or configure the executable path.';
    }
    if (error.message.includes('Invalid LaTeX executable')) {
      return error.message;
    }
    if (error.message.includes('Invalid characters in executable path')) {
      return 'The configured LaTeX executable path contains invalid characters.';
    }
    // Check for compilation errors
    if (error.message.includes('Command failed') || (error as { code?: string }).code === '1') {
      return 'LaTeX compilation failed. Check the output panel for details.';
    }
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}

function formatUserMessage(errorMessage: string, context: 'compile' | 'refresh' | 'watch'): string {
  const prefix = {
    compile: 'Failed to compile LaTeX',
    refresh: 'Failed to refresh preview',
    watch: 'Compilation error'
  }[context];

  // Avoid redundant messaging
  if (errorMessage.includes('LaTeX')) {
    return errorMessage;
  }

  return `${prefix}: ${errorMessage}`;
}
