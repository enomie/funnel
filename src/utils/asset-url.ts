// Path: /Users/johann/MyBrew/funnel-real/src/utils/asset-url.ts


export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  return `${base}${path.replace(/^\/+/, '')}`;
}
