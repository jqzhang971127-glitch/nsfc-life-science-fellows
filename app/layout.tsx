import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生命科学部杰青档案与申请代码",
  description: "国家自然科学基金生命科学部历年杰青档案、现行申请代码与证据来源查询Demo。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cloudflareToken = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;

  return (
    <html lang="zh-CN">
      <body>
        {children}
        {cloudflareToken ? (
          <script
            defer
            type="module"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: cloudflareToken, spa: false })}
          />
        ) : null}
      </body>
    </html>
  );
}
