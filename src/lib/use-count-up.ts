'use client'

/**
 * KPI 数字滚动动画 Hook（移植自 docs/model-eval-dashboard.html L834-851 的 animateCount）。
 * SSR 安全：首帧渲染终值，避免 hydration mismatch；挂载后在 useEffect 里
 * 检测 prefers-reduced-motion，非 reduced 时从 0 开始 rAF 动画到 target，
 * target 变化时重放。
 */

import { useEffect, useRef, useState } from 'react'
import { COUNT_UP_DURATION_MS, countUpValueAt, formatCount } from './count-up'

export function useCountUp(target: number, pad = 0): string {
  // 首帧（含 SSR）直接渲染终值；动画只在客户端 effect 中重放
  const [display, setDisplay] = useState(() => formatCount(target, pad))

  const mountedRef = useRef(false)
  const previousTargetRef = useRef(target)

  useEffect(() => {
    const finalDisplay = formatCount(target, pad)

    // 首帧仍然使用服务端终值，避免 hydration mismatch；挂载后再从 0 播放一次，
    // 让首屏 KPI 真正有 count-up 动效。reduced-motion 用户直接落到终值。
    if (!mountedRef.current) {
      mountedRef.current = true
      previousTargetRef.current = target
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setDisplay(finalDisplay)
        return
      }
      setDisplay(formatCount(0, pad))
    }

    if (mountedRef.current && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      previousTargetRef.current = target
      setDisplay(finalDisplay)
      return
    }

    const from = mountedRef.current && previousTargetRef.current === target
      ? 0
      : previousTargetRef.current
    previousTargetRef.current = target
    let raf = 0
    let start: number | null = null
    const step = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      if (elapsed >= COUNT_UP_DURATION_MS) {
        setDisplay(finalDisplay)
        return
      }
      const easedDelta = countUpValueAt(target - from, elapsed)
      setDisplay(formatCount(from + easedDelta, pad))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, pad])

  return display
}
