/**
 * Parse markdown-style code blocks from text
 * Supports: ```language\ncode\n```
 */

export interface ParsedCodeBlock {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedContent {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * Extract all code blocks from text
 */
export function extractCodeBlocks(text: string): ParsedCodeBlock[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: ParsedCodeBlock[] = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'code',
      code: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return blocks;
}

/**
 * Parse text and code blocks into segments
 * Useful for rendering mixed text and code content
 */
export function parseContentWithCodeBlocks(text: string): ParsedContent[] {
  const blocks = extractCodeBlocks(text);

  if (blocks.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const result: ParsedContent[] = [];
  let lastIndex = 0;

  blocks.forEach((block) => {
    // Add text before this code block
    if (block.startIndex > lastIndex) {
      const textBefore = text.substring(lastIndex, block.startIndex).trim();
      if (textBefore) {
        result.push({ type: 'text', content: textBefore });
      }
    }

    // Add code block
    result.push({
      type: 'code',
      content: block.code,
      language: block.language,
    });

    lastIndex = block.endIndex;
  });

  // Add any remaining text
  if (lastIndex < text.length) {
    const textAfter = text.substring(lastIndex).trim();
    if (textAfter) {
      result.push({ type: 'text', content: textAfter });
    }
  }

  return result;
}

/**
 * Check if text contains code blocks
 */
export function hasCodeBlocks(text: string): boolean {
  return /```\w*\n[\s\S]*?```/g.test(text);
}

/**
 * Get first code block from text (if exists)
 */
export function getFirstCodeBlock(text: string): ParsedCodeBlock | null {
  const blocks = extractCodeBlocks(text);
  return blocks.length > 0 ? blocks[0] : null;
}

/**
 * Get all code blocks with their positions
 */
export function getAllCodeBlocks(text: string): ParsedCodeBlock[] {
  return extractCodeBlocks(text);
}

/**
 * Language aliases for better display
 */
export const languageAliases: { [key: string]: string } = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  json: 'json',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sql: 'sql',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  ruby: 'ruby',
  go: 'go',
  rust: 'rust',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  dart: 'dart',
  r: 'r',
  matlab: 'matlab',
};

/**
 * Normalize language name
 */
export function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase().trim();
  return languageAliases[lower] || lower;
}

/**
 * Count code blocks in text
 */
export function countCodeBlocks(text: string): number {
  return extractCodeBlocks(text).length;
}

/**
 * Remove code blocks from text (for plain text extraction)
 */
export function removeCodeBlocks(text: string): string {
  return text.replace(/```\w*\n[\s\S]*?```/g, '').trim();
}

/**
 * Escape special characters in code for display
 */
export function escapeCode(code: string): string {
  return code
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;');
}

export default {
  extractCodeBlocks,
  parseContentWithCodeBlocks,
  hasCodeBlocks,
  getFirstCodeBlock,
  getAllCodeBlocks,
  normalizeLanguage,
  countCodeBlocks,
  removeCodeBlocks,
  escapeCode,
};
