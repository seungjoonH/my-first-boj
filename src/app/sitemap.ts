import type { MetadataRoute } from 'next';

const DEFAULT_SITE_URL = 'https://my-first-boj.vercel.app';

function resolveSiteUrl(rawValue: string | undefined): string {
  const normalizedValue = (rawValue ?? '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!normalizedValue) return DEFAULT_SITE_URL;

  try { return new URL(normalizedValue).origin; } 
  catch { return DEFAULT_SITE_URL; }
}

const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
