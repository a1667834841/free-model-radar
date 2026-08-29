/**
 * JSON 语法高亮（移植自 docs/model-eval-dashboard.html L1116-1127）。
 * 输出 HTML 字符串，供 dangerouslySetInnerHTML 使用；
 * 输入先整体 escapeHtml，因此对值中的 HTML/脚本是安全的。
 */

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 轻量 JSON 语法高亮：键(.k 紫)/字符串(.s 绿)/数字(.num 橙)分色。
 * 注意：设计稿 L1121-1127 的链式 replace 有 bug（第二步会匹配刚插入的 class="k"），
 * 这里改为单遍 token 替换，输出格式与设计稿意图一致（冒号包含在 .k span 内）。
 */
export function highlightJson(obj: unknown): string {
  const raw = escapeHtml(JSON.stringify(obj, null, 2));
  return raw.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str: string | undefined, colon: string | undefined, num: string | undefined) => {
      if (str !== undefined) {
        return colon !== undefined
          ? `<span class="k">${str}${colon}</span>`
          : `<span class="s">${str}</span>`;
      }
      return `<span class="num">${num}</span>`;
    },
  );
}
