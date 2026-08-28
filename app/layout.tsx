import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Free Model Radar',
  description: 'Model availability and latency radar for OpenAI-compatible providers',
  icons: '/fm-logo.svg',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
