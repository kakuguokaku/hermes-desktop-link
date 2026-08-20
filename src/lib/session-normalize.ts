import type { Message, SessionDetail } from './api';

function safeContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((v) => (v && typeof v === 'object' && typeof (v as any).text === 'string' ? (v as any).text : String(v ?? ''))).join('');
  return value == null ? '' : String(value);
}

export function normalizeSessionDetail(value: any): SessionDetail {
  const raw = Array.isArray(value?.messages) ? value.messages : [];
  const messages: Message[] = raw
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m: any) => ({
      id: m.id == null ? null : String(m.id),
      role: m.role,
      content: safeContent(m.content),
      createdAt: m.createdAt == null ? null : String(m.createdAt),
      ...(Array.isArray(m.attachments) ? { attachments: m.attachments.filter((a: any) => a && (a.kind === 'image' || a.kind === 'file') && typeof a.name === 'string').map((a: any) => ({ kind: a.kind, name: a.name, uri: typeof a.uri === 'string' ? a.uri : undefined, size: typeof a.size === 'number' ? a.size : undefined })) } : {}),
    }));
  return { session: value?.session ?? { id: null, title: null }, messages } as SessionDetail;
}

