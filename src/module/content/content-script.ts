// Content Script to gray out blocked domains
console.log('Pi-hole Browser Extension: Content Script loaded.')

async function scanAndGrayOutLinks() {
  const anchors = document.querySelectorAll('a[href]')
  const uniqueDomains = new Set<string>()
  const anchorMap = new Map<string, HTMLAnchorElement[]>()

  anchors.forEach(a => {
    try {
      const url = new URL((a as HTMLAnchorElement).href)
      // We only care about http/https protocols and external domains to not break the current site
      const currentHost = window.location.hostname
      const isExternal = url.hostname !== currentHost && !url.hostname.endsWith(`.${currentHost}`)

      if (['http:', 'https:'].includes(url.protocol) && isExternal) {
        uniqueDomains.add(url.hostname)
        if (!anchorMap.has(url.hostname)) {
          anchorMap.set(url.hostname, [])
        }
        anchorMap.get(url.hostname)!.push(a as HTMLAnchorElement)
      }
    } catch {
      // Invalid URL, ignore
    }
  })

  const domains = Array.from(uniqueDomains)
  if (domains.length === 0) return

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'checkDomains',
      domains
    })

    if (response && response.blockedDomains && Array.isArray(response.blockedDomains)) {
      const blockedDomains = response.blockedDomains as string[]
      blockedDomains.forEach(domain => {
        const matchingAnchors = anchorMap.get(domain)
        if (matchingAnchors) {
          matchingAnchors.forEach(elem => {
            const a = elem
            a.style.opacity = '0.3'
            a.style.textDecoration = 'line-through'
            a.title = 'Blocked by Pi-Hole'
          })
        }
      })
    }
  } catch (err) {
    console.debug('Pi-Hole Extension: Error checking domains:', err)
  }
}

// Initial scan
scanAndGrayOutLinks()

// Optional: Observe the DOM for dynamically loaded links (like infinite scrolling)
const observer = new MutationObserver((mutations) => {
  let hasNewLinks = false
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes as any) {
        if (node.nodeType === 1 && (node.tagName === 'A' || node.querySelector('a'))) {
          hasNewLinks = true
          break
        }
      }
    }
    if (hasNewLinks) break
  }
  
  if (hasNewLinks) {
    // Debounce to prevent flooding
    if ((window as any).piholeCheckTimeout) {
      clearTimeout((window as any).piholeCheckTimeout)
    }
    ;(window as any).piholeCheckTimeout = setTimeout(() => {
      scanAndGrayOutLinks()
    }, 500)
  }
})

observer.observe(document.body, { childList: true, subtree: true })
