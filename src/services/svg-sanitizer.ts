const MAX_SVG_BYTES = 200 * 1024

const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'path', 'rect', 'circle', 'ellipse', 'line',
  'polyline', 'polygon', 'text', 'tspan', 'title', 'desc', 'lineargradient',
  'radialgradient', 'stop', 'clippath', 'mask', 'pattern', 'marker',
  'animate', 'animatetransform', 'set',
])

const ALLOWED_ATTRIBUTES = new Set([
  'xmlns', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx',
  'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-opacity', 'fill-rule', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'stroke-dasharray',
  'stroke-dashoffset', 'opacity', 'transform', 'id', 'class', 'clip-path', 'mask',
  'gradientunits', 'gradienttransform', 'offset', 'stop-color', 'stop-opacity',
  'patternunits', 'patterntransform', 'marker-start', 'marker-mid', 'marker-end',
  'markerwidth', 'markerheight', 'refx', 'refy', 'orient', 'preserveaspectratio',
  'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
  'dx', 'dy', 'letter-spacing', 'role', 'aria-label',
  'attributename', 'from', 'to', 'values', 'dur', 'begin', 'end', 'repeatcount',
  'calcmode', 'keytimes', 'keysplines', 'additive', 'accumulate', 'type',
])

function isSafeAttributeValue(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase()
  if (normalized.includes('javascript:') || normalized.includes('data:') || normalized.includes('vbscript:')) return false
  if (/url\((?!['"]?#)/i.test(normalized)) return false
  return true
}

function sanitizeTag(tag: string): string {
  const match = tag.match(/^<\s*(\/?)\s*([a-zA-Z][\w:-]*)([\s\S]*?)(\/?)\s*>$/)
  if (!match) throw new Error('SVG 包含无法解析的标签')
  const [, closing, rawName, rawAttributes, selfClosing] = match
  const name = rawName.toLowerCase()
  if (!ALLOWED_ELEMENTS.has(name)) throw new Error(`SVG 包含不允许的元素: ${rawName}`)
  if (closing) return `</${rawName}>`

  const attributes: string[] = []
  const attributePattern = /([^\s=/>]+)\s*=\s*("[^"]*"|'[^']*')/g
  let consumed = ''
  for (const attribute of rawAttributes.matchAll(attributePattern)) {
    consumed += attribute[0]
    const attributeName = attribute[1].toLowerCase()
    const value = attribute[2].slice(1, -1)
    if (attributeName.startsWith('on') || attributeName === 'style' || attributeName === 'href' || attributeName === 'xlink:href') continue
    if (!ALLOWED_ATTRIBUTES.has(attributeName) || !isSafeAttributeValue(value)) continue
    attributes.push(`${attribute[1]}="${value.replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;').replace(/"/g, '&quot;')}"`)
  }

  // 除空白外还有未被属性解析器消费的内容时，拒绝整个 SVG。
  const remainder = rawAttributes.replace(attributePattern, '').trim()
  if (remainder) throw new Error('SVG 包含无效属性')
  return `<${rawName}${attributes.length ? ` ${attributes.join(' ')}` : ''}${selfClosing ? ' /' : ''}>`
}

export function sanitizeSvgResponse(rawResponse: string): string {
  const match = rawResponse.match(/<svg\b[\s\S]*?<\/svg\s*>/i)
  if (!match) throw new Error('模型返回中没有完整 SVG')
  const source = match[0]
  if (new TextEncoder().encode(source).byteLength > MAX_SVG_BYTES) throw new Error('SVG 超过 200 KB 限制')
  if (/<!DOCTYPE|<!ENTITY|<\?xml|<\s*(?:script|foreignObject|iframe|object|embed|image|audio|video|link|style)\b/i.test(source)) {
    throw new Error('SVG 包含不安全内容')
  }
  // XML 注释本身没有执行能力，但注释内容可能包含类似标签；先完整移除，
  // 再对剩余标签做严格白名单解析。未闭合注释视为畸形输入。
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '')
  if (/<!--|-->/.test(withoutComments)) throw new Error('SVG 注释未正确闭合')

  const tags = withoutComments.match(/<[^>]+>/g)
  if (!tags || !/^<svg\b/i.test(tags[0]) || !/<\/svg\s*>$/i.test(tags.at(-1) ?? '')) {
    throw new Error('SVG 结构无效')
  }
  let cursor = 0
  let output = ''
  const elementStack: string[] = []
  for (const tag of tags) {
    const index = withoutComments.indexOf(tag, cursor)
    const text = withoutComments.slice(cursor, index)
    output += text.replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;')
    const parsed = tag.match(/^<\s*(\/?)\s*([a-zA-Z][\w:-]*)([\s\S]*?)(\/?)\s*>$/)
    if (!parsed) throw new Error('SVG 包含无法解析的标签')
    const [, closing, rawName, , selfClosing] = parsed
    if (closing) {
      if (elementStack.pop() !== rawName) throw new Error('SVG 元素未正确配对')
    } else if (!selfClosing) {
      elementStack.push(rawName)
    }
    output += sanitizeTag(tag)
    cursor = index + tag.length
  }
  output += withoutComments.slice(cursor).replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;')
  if (elementStack.length > 0) throw new Error('SVG 元素未正确闭合')
  return output
}

export const svgSanitizerInternals = { isSafeAttributeValue, sanitizeTag, MAX_SVG_BYTES }
