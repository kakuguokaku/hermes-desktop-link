export function isEmptyAssistantMessage(input: { role: string; content: string; isStreaming: boolean }): boolean {
  return input.role === 'assistant' && input.content.length === 0 && !input.isStreaming;
}

