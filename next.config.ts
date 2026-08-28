import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import type { NextConfig } from 'next'

initOpenNextCloudflareForDev()

// 将开发编译产物与生产/OpenNext 构建隔离，避免两个进程共享 `.next` 时互相清理路由清单。
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
}

export default nextConfig
