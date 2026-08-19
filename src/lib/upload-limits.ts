// src/lib/upload-limits.ts —— 附件上传大小上限（客户端拦截 + 服务端兜底，两端保持一致）
export type UploadKind = 'image' | 'file';

export const UPLOAD_LIMITS_BYTES: Record<UploadKind, number> = {
  image: 15 * 1024 * 1024, // 图片 15MB
  file: 50 * 1024 * 1024,  // 其它文件 50MB
};

export class UploadTooLargeError extends Error {
  readonly kind: UploadKind;
  readonly size: number;
  readonly limit: number;
  constructor(kind: UploadKind, size: number, limit: number) {
    super('文件超过 ' + Math.ceil(limit / 1024 / 1024) + 'MB 上限，请压缩或改用电脑端发送');
    this.name = 'UploadTooLargeError';
    this.kind = kind;
    this.size = size;
    this.limit = limit;
  }
}

/** 超限直接抛 UploadTooLargeError（不读 Base64、不发网络请求） */
export function assertUploadSize(size: number | null | undefined, kind: UploadKind): void {
  const limit = UPLOAD_LIMITS_BYTES[kind] ?? UPLOAD_LIMITS_BYTES.file;
  const s = Number(size ?? 0);
  if (s > limit) throw new UploadTooLargeError(kind, s, limit);
}

/** 字节数格式化：1234 → 1.2 KB */
export function formatBytes(n: number | null | undefined): string {
  const size = Number(n ?? 0);
  if (!size || size <= 0) return '';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / 1024 / 1024).toFixed(1) + ' MB';
}