import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { VersionBadge } from '@/components/versionBadge/VersionBadge';
import './globals.css';

const DEFAULT_SITE_URL = 'https://my-first-boj.vercel.app';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
const siteName = '나의 첫 백준은?';
const description = '백준 아이디로 첫 제출, 첫 정답, 첫 오답을 빠르게 확인해보세요.';
const ogImagePath = '/og-image.svg';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteName,
  description,
  alternates: {
    canonical: '/',
  },
  keywords: ['백준', 'boj', '첫 제출', '첫 정답', '첫 오답'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    siteName,
    title: siteName,
    description,
    images: [
      {
        url: ogImagePath,
        width: 1200,
        height: 630,
        alt: `${siteName} OG 이미지`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description,
    images: [ogImagePath],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <VersionBadge />
        <Analytics />
      </body>
    </html>
  );
}
