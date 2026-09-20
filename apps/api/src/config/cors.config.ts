type Environment = NodeJS.ProcessEnv;

const localDevelopmentOrigins = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
];

function isOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

export function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(value.split(',').map((origin) => origin.trim()).filter(isOrigin))];
}

export function createCorsOptions(environment: Environment = process.env) {
  const configuredOrigins = parseCorsOrigins(environment.CORS_ORIGINS);
  const isProduction = environment.NODE_ENV === 'production';
  const origins = configuredOrigins.length > 0 ? configuredOrigins : isProduction ? [] : localDevelopmentOrigins;

  return {
    origin: origins.length > 0 ? origins : false,
    credentials: false,
  };
}
