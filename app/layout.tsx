import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jqzhang971127-glitch.github.io/nsfc-life-science-fellows/"),
  title: "国家自然科学基金杰青档案与申请代码数据库",
  description: "生命科学、医学科学与信息科学三个学部的历年杰青及青年科学基金项目（A类）档案、现行申请代码与可追溯来源查询。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "国家自然科学基金杰青档案与申请代码数据库",
    description: "生命科学部、医学科学部、信息科学部三个独立可检索数据库。",
    images: [{ url: "og.png" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "国家自然科学基金杰青档案与申请代码数据库",
    description: "生命科学部、医学科学部、信息科学部三个独立可检索数据库。",
    images: ["og.png"],
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
