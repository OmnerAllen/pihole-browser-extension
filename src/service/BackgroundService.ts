import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import { BadgeService, ExtensionBadgeTextEnum } from './BadgeService'
import { PiHoleSettingsDefaults, StorageService } from './StorageService'
import PiHoleApiService from './PiHoleApiService'
import TabService from './TabService'
import ApiList from '../api/enum/ApiList'

export default class BackgroundService {
  public static togglePiHole(): void {
    let newStatus: PiHoleApiStatusEnum
    BadgeService.getBadgeText().then(result => {
      if (result === ExtensionBadgeTextEnum.disabled) {
        newStatus = PiHoleApiStatusEnum.enabled
      } else if (result === ExtensionBadgeTextEnum.enabled) {
        newStatus = PiHoleApiStatusEnum.disabled
      } else {
        return
      }

      StorageService.getDefaultDisableTime().then(value => {
        let disableTime = value
        if (typeof disableTime === 'undefined') {
          disableTime = PiHoleSettingsDefaults.default_disable_time
        }

        PiHoleApiService.changePiHoleStatus(newStatus, disableTime)
          .then(data => {
            for (const piHoleStatus of data) {
              if (
                piHoleStatus.data.blocking === PiHoleApiStatusEnum.error ||
                piHoleStatus.data.blocking !== newStatus
              ) {
                console.warn(
                  'One PiHole returned Error from its request. Please check the API Key.'
                )
                BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
                return
              }
            }
            BadgeService.setBadgeText(
              newStatus === PiHoleApiStatusEnum.disabled
                ? ExtensionBadgeTextEnum.disabled
                : ExtensionBadgeTextEnum.enabled
            )

            StorageService.getReloadAfterDisable().then(state => {
              if (typeof state !== 'undefined' && state) {
                TabService.reloadCurrentTab(1500)
              }
            })
          })
          .catch(reason => {
            console.warn(reason)
            BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
          })
      })
    })
  }

  public static blacklistCurrentDomain(): void {
    TabService.getCurrentTabUrlCleaned().then(url => {
      if (url.length < 1) {
        return
      }
      PiHoleApiService.subDomainFromList(ApiList.whitelist, url)
        .then(() => {
          PiHoleApiService.addDomainToList(ApiList.blacklist, url)
            .then(() => {
              BadgeService.setBadgeText(ExtensionBadgeTextEnum.ok)
            })
            .catch(reason => {
              console.warn(reason)
              BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
            })
        })
        .catch(reason => {
          console.warn(reason)
          BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
        })
    })
  }

  public static whitelistCurrentDomain(): void {
    TabService.getCurrentTabUrlCleaned().then(url => {
      if (url.length < 1) {
        return
      }
      PiHoleApiService.subDomainFromList(ApiList.blacklist, url)
        .then(() => {
          PiHoleApiService.addDomainToList(ApiList.whitelist, url)
            .then(() => {
              StorageService.getReloadAfterWhitelist().then(state => {
                if (typeof state === 'undefined') {
                  return
                }
                if (state) {
                  TabService.reloadCurrentTab(1500)
                }
              })
              BadgeService.setBadgeText(ExtensionBadgeTextEnum.ok)
            })
            .catch(reason => {
              console.warn(reason)
              BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
            })
        })
        .catch(reason => {
          console.warn(reason)
          BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
        })
    })
  }

  public static openOptions(): void {
    chrome.runtime.openOptionsPage()
  }

  public static async blockDomainFromZap(
    pageUrl: string,
    urlCandidates: string[]
  ): Promise<void> {
    if (!urlCandidates || urlCandidates.length === 0) {
      console.warn('No URL candidates from zap; aborting')
      BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
      return
    }

    const pageHost = (() => {
      try {
        return new URL(pageUrl).hostname
      } catch (e) {
        return ''
      }
    })()

    const cdnHosts = [
      'cdnjs.cloudflare.com',
      'cdn.jsdelivr.net',
      'unpkg.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com'
    ]

    const hostFromUrl = (u: string): string | null => {
      try {
        return new URL(u).hostname
      } catch (e) {
        return null
      }
    }

    const isCdnHost = (host: string): boolean => cdnHosts.includes(host)

    const candidateHosts = urlCandidates
      .map(hostFromUrl)
      .filter((h): h is string => !!h)

    const filtered = candidateHosts.filter(host => {
      if (isCdnHost(host)) {
        return false
      }
      if (pageHost && host === pageHost) {
        return false
      }
      return true
    })

    if (filtered.length === 0) {
      console.warn('Only CDN or first-party hosts detected; not blocking')
      BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
      return
    }

    const chosenHost = filtered[0]

    try {
      await PiHoleApiService.addDomainToList(ApiList.blacklist, chosenHost)
      BadgeService.setBadgeText(ExtensionBadgeTextEnum.ok)
      TabService.reloadCurrentTab(1500)
    } catch (e) {
      console.warn('Failed to add zap domain to PiHole', e)
      BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
    }
  }
}
