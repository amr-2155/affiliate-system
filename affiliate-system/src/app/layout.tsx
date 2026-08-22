import type { Metadata } from "next"
import "./globals.css"
import AuthProvider from "@/components/AuthProvider"
import { ToastProvider } from "@/components/Toast"
import ThemeProvider from "@/components/ThemeProvider"
import ThemeModeProvider from "@/components/ThemeModeProvider"

export const metadata: Metadata = {
  title: "AFFILIATE - نظام التسويق بالعمولة",
  description: "نظام إدارة الأفلييت والتسويق بالعمولة - منصة احترافية لإدارة المنتجات والطلبات والمسوقين",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" className="antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme-mode");if(t==="dark"||(!t&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <AuthProvider>
          <ThemeProvider>
            <ThemeModeProvider>
              <ToastProvider>{children}</ToastProvider>
            </ThemeModeProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
