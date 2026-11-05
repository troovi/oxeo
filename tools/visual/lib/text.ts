/** Текстовые помощники генератора: русские формы числа и экранирование для HTML и SVG. */

export const plural = (n: number, forms: [string, string, string]) => {
  const m10 = n % 10
  const m100 = n % 100
  const form = m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 1 : 2
  return `${n} ${forms[form]}`
}

export const escapeXml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
