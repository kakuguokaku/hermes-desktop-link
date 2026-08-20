/** A fresh id is selected as soon as the share extension opens. */
export function createDefaultShareTarget(now = Date.now()): string {
  return `app-share-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Once the bridge has accepted the request, delivery continues in background. */
export function shouldLeaveShareAfterBridgeAccepts(): boolean {
  return true;
}
