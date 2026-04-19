import apple180 from './assets/apple-touch-180.png'
import tab16 from './assets/tab-icon-16.png'
import tab32 from './assets/tab-icon-32.png'

/** Vite가 파일 해시를 붙인 URL로 주입해 배포·브라우저 캐시가 옛 파비콘에 고정되지 않게 함 */
export function injectFavicons(): void {
  const add = (rel: string, href: string, extra?: { type?: string; sizes?: string }) => {
    const link = document.createElement('link')
    link.rel = rel
    link.href = href
    if (extra?.type) link.type = extra.type
    if (extra?.sizes) link.setAttribute('sizes', extra.sizes)
    document.head.appendChild(link)
  }

  add('icon', tab32, { type: 'image/png', sizes: '32x32' })
  add('icon', tab16, { type: 'image/png', sizes: '16x16' })
  add('apple-touch-icon', apple180)
}
