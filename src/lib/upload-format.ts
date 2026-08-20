export function makeLegacyUploadPayload(name: string, kind: 'image' | 'file', dataBase64: string) {
  return { name, kind, dataBase64 };
}

