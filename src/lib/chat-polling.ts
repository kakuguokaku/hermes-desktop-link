export function shouldPollSession({
  focused,
  appActive,
  online,
  hasConfig,
  sessionId,
}: {
  focused: boolean;
  appActive: boolean;
  online: boolean;
  hasConfig: boolean;
  sessionId: string | null;
}): boolean {
  return focused && appActive && online && hasConfig && !!sessionId;
}

export function shouldHandleStreamEvent(
  streaming: boolean,
  activeRequestId: string | null,
  requestId: string | undefined
): boolean {
  return streaming && (requestId === undefined || requestId === activeRequestId);
}
