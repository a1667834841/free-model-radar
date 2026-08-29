/**
 * KPI 数字滚动动画（移植自 docs/model-eval-dashboard.html L834-851）。
 * 620ms 三次缓出 count-up，支持补零；reduced-motion 时直接落终值。
 */

export const COUNT_UP_DURATION_MS = 620;

/** 四舍五入并按 pad 补零（设计稿 fmt：Math.round + padStart）。 */
export function formatCount(value: number, pad = 0): string {
  return Math.round(value)
    .toString()
    .padStart(pad, '0');
}

export function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

/** 动画进行到 elapsedMs 时应显示的数值（未取整）。 */
export function countUpValueAt(target: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= COUNT_UP_DURATION_MS) return target;
  return easeOutCubic(elapsedMs / COUNT_UP_DURATION_MS) * target;
}
