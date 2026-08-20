const VOICE_COMMAND = '请将此段语音转换为文字，并作为给你的命令执行。';
const IMAGE_DUMP = /\[The user attached an image[^\]]*\]/gi;

/**
 * Hermes may prepend/replace a user image message with a verbose internal
 * image dump. Remove only that dump so the app's typed/default instruction
 * remains visible below the attachment.
 */
export function userMessageDisplayText(content: string): string {
  const source = String(content || '');
  if (source.includes(VOICE_COMMAND)) return '发送了一条语音';
  const withoutDump = source.replace(IMAGE_DUMP, '').replace(/\s+/g, ' ').trim();
  return withoutDump || (/\[The user attached an image/i.test(source) ? '照片里是什么' : '');
}
