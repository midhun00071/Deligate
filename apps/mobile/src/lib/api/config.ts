export function getApiBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is required');
  }

  return apiUrl.replace(/\/$/, '');
}
