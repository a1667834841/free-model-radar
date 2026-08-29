import { describe, expect, it } from 'vitest';
import { escapeHtml, highlightJson } from '../src/lib/json-highlight';

describe('escapeHtml', () => {
  it('escapes ampersand, angle brackets', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('coerces non-string input', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('highlightJson', () => {
  it('wraps keys in span.k', () => {
    const html = highlightJson({ rank: 1 });
    expect(html).toContain('<span class="k">"rank":</span>');
  });

  it('wraps string values in span.s', () => {
    const html = highlightJson({ name: 'gemma' });
    expect(html).toContain('<span class="s">"gemma"</span>');
  });

  it('wraps numeric values in span.num', () => {
    const html = highlightJson({ ttft_ms: 1013, tps: 42.5 });
    expect(html).toContain('<span class="num">1013</span>');
    expect(html).toContain('<span class="num">42.5</span>');
  });

  it('does not treat digits inside strings as numbers', () => {
    const html = highlightJson({ model: 'gpt-4o' });
    expect(html).toContain('<span class="s">"gpt-4o"</span>');
    expect(html).not.toContain('class="num"');
  });

  it('escapes HTML in values (XSS-safe for dangerouslySetInnerHTML)', () => {
    const html = highlightJson({ evil: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('handles nested objects and arrays', () => {
    const html = highlightJson({ meta: { sample: 3 }, models: [{ rank: 1 }] });
    expect(html).toContain('<span class="k">"meta":</span>');
    expect(html).toContain('<span class="k">"rank":</span>');
    expect(html).toContain('<span class="num">1</span>');
  });
});
