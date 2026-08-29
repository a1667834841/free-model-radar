'use client'

/**
 * KPI 数字滚动动画 Hook（移植自 docs/model-eval-dashboard.html L834-851 的 animateCount）。
 * SSR 安全：首帧渲染终值，避免 hydration mismatch；挂载后在 useEffect 里
 * 检测 prefers-reduced-motion，非 reduced 时从 0 开始 rAF 动画到 target，
 * target 变化时重放。
 */

import { useEffect, useState } from 'react'
import { COUNT_UP_DURATION_MS, countUpValueAt, formatCount } from './count-up'

export function useCountUp(target: number, pad = 0): string {
  // 首帧（含 SSR）直接渲染终值；动画只在客户端 effect 中重放
  const [display, setDisplay] = useState(() => formatCount(target, pad))

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(formatCount(target, pad))
      return
    }
    let raf = 0
    let start: number | null = null
    const step = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      if (elapsed >= COUNT_UP_DURATION_MS) {
        setDisplay(formatCount(target, pad))
        return
      }
      setDisplay(formatCount(countUpValueAt(target, elapsed), pad))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, pad])

  return display
}
