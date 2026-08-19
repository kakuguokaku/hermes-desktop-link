// src/lib/markdown-detect.ts —— 判断文本是否含 markdown 语法（供选区复制智能分支）
// 纯函数、无依赖：可被 Node 直接单测（见同目录 .mts）

/**
 * 文本是否含常见 markdown 标记。纯文本 → false（渲染成单个 Text 支持 iOS 原生选区拖动）；
 * 含标记 → true（走 markdown 渲染，保留排版）。块级标记逐行扫描，支持"引导句+列表"的多行消息。
 */
export function hasMarkdown(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  // 块级：逐行扫描（支持"说明文字 + 列表"的多行消息）
  for (const raw of trimmed.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s*/.test(line)) return true; // 标题（允许无空格）
    if (/^[-*+]\s+/.test(line)) return true; // 无序列表
    if (/^\d+\.\s+/.test(line)) return true; // 有序列表
    if (/^>\s?/.test(line)) return true; // 引用（允许无空格）
    if (/^```|^~~~/.test(line)) return true; // 代码围栏
    if (/^\|.*\|\s*$/.test(line)) return true; // 表格行
    if (/^(---|\*\*\*+)\s*$/.test(line)) return true; // 分隔线
  }
  // 行内（对整个内容）
  if (/\*\*|__|~~|`|\[[^\]]*\]\([^)]*\)|!\[[^\]]*\]\([^)]*\)/.test(trimmed)) return true;
  // 斜体：左右不能是字母数字（避免 2*3*4 / a*b*c 误判）
  if (/(^|[^A-Za-z0-9])\*[^*]+\*(?![A-Za-z0-9])/.test(trimmed)) return true;
  return false;
}
