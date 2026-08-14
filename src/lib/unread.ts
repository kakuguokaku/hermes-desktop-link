// src/lib/unread.ts —— 会话栏"有更新"标记（内存态）
// 后台/其它会话更新时在列表上点亮小圆点，点进去清除；正在查看的会话自身更新不标记。
type Listener = () => void;

let current: string | null = null; // 当前正在查看的会话 id（聊天页设置）
let marked: Set<string> = new Set();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((cb) => cb());
}

export const unread = {
  setCurrent(id: string | null) {
    current = id;
  },
  mark(sid: string) {
    if (sid !== current) {
      marked.add(sid);
      emit();
    }
  },
  clear(sid: string) {
    if (marked.delete(sid)) emit();
  },
  has(sid: string) {
    return marked.has(sid);
  },
  snapshot(): Set<string> {
    return new Set(marked);
  },
  subscribe(cb: Listener): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
