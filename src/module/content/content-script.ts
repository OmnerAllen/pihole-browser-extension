// Content script for PiHole element zapper

interface ZapCandidateMessage {
  type: 'zap_candidate_found'
  pageUrl: string
  urlCandidates: string[]
  elementInfo: {
    tagName: string
    id: string
    className: string
  }
}

interface EnterZapModeMessage {
  type: 'enter_zap_mode'
}

interface ZapResultMessage {
  type: 'zap_result'
  status: 'success' | 'error'
  message?: string
}

type IncomingMessage = EnterZapModeMessage | ZapResultMessage

let zapActive = false
let lastHighlightedElement: HTMLElement | null = null
let keydownHandler: ((event: KeyboardEvent) => void) | null = null
let mouseMoveHandler: ((event: MouseEvent) => void) | null = null
let clickHandler: ((event: MouseEvent) => void) | null = null

function highlightElement(el: HTMLElement | null): void {
  if (lastHighlightedElement) {
    lastHighlightedElement.classList.remove('pihole-zap-highlight')
  }
  if (el) {
    el.classList.add('pihole-zap-highlight')
    lastHighlightedElement = el
  } else {
    lastHighlightedElement = null
  }
}

function ensureStyleElement(): void {
  if (document.getElementById('pihole-zap-style')) {
    return
  }
  const style = document.createElement('style')
  style.id = 'pihole-zap-style'
  style.textContent = `
    .pihole-zap-highlight {
      outline: 2px solid #ff9800 !important;
      cursor: crosshair !important;
    }
    #pihole-zap-overlay {
      position: fixed;
      left: 0;
      bottom: 0;
      right: 0;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      font: 12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 4px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
    }
    #pihole-zap-overlay button {
      pointer-events: auto;
      margin-left: 8px;
      background: transparent;
      border: 1px solid #fff;
      color: #fff;
      padding: 2px 6px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
    }
  `
  document.documentElement.appendChild(style)
}

function exitZapMode(): void {
  zapActive = false
  if (keydownHandler) {
    window.removeEventListener('keydown', keydownHandler, true)
    keydownHandler = null
  }
  if (mouseMoveHandler) {
    window.removeEventListener('mousemove', mouseMoveHandler, true)
    mouseMoveHandler = null
  }
  if (clickHandler) {
    window.removeEventListener('click', clickHandler, true)
    clickHandler = null
  }
  highlightElement(null)
  const overlay = document.getElementById('pihole-zap-overlay')
  if (overlay) {
    overlay.remove()
  }
}

function showOverlay(): void {
  ensureStyleElement()
  if (document.getElementById('pihole-zap-overlay')) {
    return
  }
  const overlay = document.createElement('div')
  overlay.id = 'pihole-zap-overlay'
  const text = document.createElement('span')
  text.textContent =
    'PiHole zap mode: click an element to block its source. Press Esc or Cancel to exit.'
  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = 'Cancel'
  cancelBtn.addEventListener('click', () => {
    exitZapMode()
  })
  overlay.appendChild(text)
  overlay.appendChild(cancelBtn)
  document.body.appendChild(overlay)
}

function enterZapMode(): void {
  if (zapActive) return
  zapActive = true
  ensureStyleElement()
  showOverlay()

  mouseMoveHandler = (event: MouseEvent) => {
    if (!zapActive) return
    const target = event.target as HTMLElement | null
    if (target && target !== lastHighlightedElement) {
      highlightElement(target)
    }
  }

  clickHandler = (event: MouseEvent) => {
    if (!zapActive) return
    event.preventDefault()
    event.stopPropagation()
    const target = event.target as HTMLElement | null
    if (!target) {
      exitZapMode()
      return
    }

    const urlCandidates: string[] = []
    const attrs = ['src', 'href', 'data-src']
    let el: HTMLElement | null = target
    let depth = 0
    while (el && depth < 5) {
      for (const attr of attrs) {
        const value = (el as any)[attr] || el.getAttribute(attr)
        if (typeof value === 'string' && value.startsWith('http')) {
          urlCandidates.push(value)
        }
      }
      const style = window.getComputedStyle(el)
      const bgImage = style.getPropertyValue('background-image')
      const match = bgImage.match(/url\("?(.*?)"?\)/)
      if (match && match[1].startsWith('http')) {
        urlCandidates.push(match[1])
      }
      el = el.parentElement
      depth += 1
    }

    const message: ZapCandidateMessage = {
      type: 'zap_candidate_found',
      pageUrl: window.location.href,
      urlCandidates: Array.from(new Set(urlCandidates)),
      elementInfo: {
        tagName: target.tagName,
        id: target.id,
        className: target.className
      }
    }

    chrome.runtime.sendMessage(message)
    exitZapMode()
  }

  keydownHandler = (event: KeyboardEvent) => {
    if (!zapActive) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      exitZapMode()
    }
  }

  window.addEventListener('mousemove', mouseMoveHandler, true)
  window.addEventListener('click', clickHandler, true)
  window.addEventListener('keydown', keydownHandler, true)
}

chrome.runtime.onMessage.addListener((message: IncomingMessage) => {
  if (message.type === 'enter_zap_mode') {
    enterZapMode()
  } else if (message.type === 'zap_result') {
    if (message.status === 'error') {
      // eslint-disable-next-line no-console
      console.warn('PiHole zap error:', message.message)
    }
  }
})

// eslint-disable-next-line no-console
console.debug('PiHole content script loaded')
