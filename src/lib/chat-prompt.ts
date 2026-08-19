// src/lib/chat-prompt.ts —— 附件默认提示词（对话页与分享页共用，和 bridge 保持一致）
export function buildAttachmentPrompt(hasImage: boolean, hasFile: boolean): string {
  if (hasImage && hasFile) return '请读取并分析这些附件';
  if (hasFile) return '请读取这个文件并告诉我这是什么';
  if (hasImage) return '照片里是什么';
  return '';
}

/** 发送正文：有文字用文字；无文字按附件类型补默认提示（保证 bridge 不会因空正文丢弃消息） */
export function contentForSend(text: string, hasImage: boolean, hasFile: boolean): string {
  const trimmed = String(text || '').trim();
  return trimmed || buildAttachmentPrompt(hasImage, hasFile);
}