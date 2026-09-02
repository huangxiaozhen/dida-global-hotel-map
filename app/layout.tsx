import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Dida 全球酒店地图与 Destination 钻取',
  description:
    '按国家查看 Dida 全球酒店静态分布，并按照 DestinationID 钻取国家内城市与目的地。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script src="./hotel-map-data.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
