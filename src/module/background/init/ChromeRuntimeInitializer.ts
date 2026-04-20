import { Initializer } from '../../general/Initializer'
import { LinkConfig } from '../../../service/i18NService'
import {
  PiHoleSettingsDefaults,
  StorageService
} from '../../../service/StorageService'
import {
  BadgeService,
  ExtensionBadgeTextEnum
} from '../../../service/BadgeService'

export default class ChromeRuntimeInitializer implements Initializer {
  public init(): void {
    chrome.runtime.onInstalled.addListener(details => {
      if (details.reason === 'install') {
        StorageService.saveDefaultDisableTime(
          Number(PiHoleSettingsDefaults.default_disable_time)
        )
        StorageService.saveReloadAfterDisable(true)
        StorageService.saveReloadAfterWhitelist(true)
      } else if (details.reason === 'update' && details.previousVersion) {
        const previousVersion = Number(
          details.previousVersion.split('.').join('')
        )
        const thisVersion = Number(
          chrome.runtime
            .getManifest()
            .version.split('.')
            .join('')
        )
        console.log(`Updated from ${previousVersion} to ${thisVersion}!`)

        // Clear all settings if update from any version to 4.0.0
        if (previousVersion < 400 && thisVersion >= 400) {
          StorageService.clearStorage().then(() => {
            StorageService.saveDefaultDisableTime(
              Number(PiHoleSettingsDefaults.default_disable_time)
            )
            StorageService.saveReloadAfterDisable(true)
            StorageService.saveReloadAfterWhitelist(true)
            // Set badge to INFO
            BadgeService.setBadgeText(ExtensionBadgeTextEnum.info)
          })
        }
      }
    })

    // Hook to show a survey after uninstalling the extension
    chrome.runtime.setUninstallURL(LinkConfig.uninstall_survey)

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'checkDomains' && request.domains) {
        this.checkDomains(request.domains).then(sendResponse)
        // Return true to indicate we wish to send a response asynchronously
        return true
      }
      return false
    })
  }

  private async checkDomains(domains: string[]): Promise<{ blockedDomains: string[] }> {
    const blockedDomains: string[] = []
    const batchSize = 3 // Throttle concurrent requests to avoid network starvation

    // eslint-disable-next-line no-restricted-syntax
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize)
      const promises = batch.map(async domain => {
        try {
          const controller = new AbortController()
          const id = setTimeout(() => controller.abort(), 800)
          // Use no-cors and no-store trying to only provoke DNS resolution
          await fetch(`http://${domain}/`, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
          clearTimeout(id)
          return { domain, blocked: false }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            return { domain, blocked: false }
          }
          // Connection refused or DNS block (Pi-hole often 0.0.0.0 or NXDOMAIN) makes it fail
          return { domain, blocked: true }
        }
      })

      // eslint-disable-next-line no-await-in-loop
      const results = await Promise.all(promises)
      blockedDomains.push(...results.filter(r => r.blocked).map(r => r.domain))
      
      // Delay slightly between batches to allow normal page networking to proceed
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return { blockedDomains }
  }
}
