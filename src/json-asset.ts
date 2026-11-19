export async function parseJsonObjectAsset(
  response: Response,
  missingMessage: string,
  invalidFormatMessage: string,
): Promise<Record<string, unknown>> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(missingMessage);
  }
  const value = await response.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(invalidFormatMessage);
  }
  return value as Record<string, unknown>;
}
