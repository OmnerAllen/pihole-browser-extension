import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import { BadgeService, ExtensionBadgeTextEnum } from './BadgeService'
import { PiHoleSettingsDefaults, StorageService } from './StorageService'
import PiHoleApiService from './PiHoleApiService'
import TabService from './TabService'
import ApiList from '../api/enum/ApiList'
import ActionFeedbackService from './ActionFeedbackService'

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
            if (!ActionFeedbackService.validateToggleResponses(data, newStatus)) {
              return
            }
            ActionFeedbackService.clearLastError()
            BadgeService.setBadgeText(
              newStatus === PiHoleApiStatusEnum.disabled
                ? ExtensionBadgeTextEnum.disabled
                : ExtensionBadgeTextEnum.enabled
            )
            ActionFeedbackService.notifyToggleSuccess(
              newStatus === PiHoleApiStatusEnum.enabled
            )

            StorageService.getReloadAfterDisable().then(state => {
              if (typeof state !== 'undefined' && state) {
                TabService.reloadCurrentTab(1500)
              }
            })
          })
          .catch(reason => {
            ActionFeedbackService.reportApiFailure(reason)
          })
      })
    })
  }

  public static blacklistHostname(hostname: string): void {
    if (hostname.length < 1) {
      return
    }
    PiHoleApiService.subDomainFromList(ApiList.whitelist, hostname)
      .then(() => {
        PiHoleApiService.addDomainToList(ApiList.blacklist, hostname)
          .then(() => {
            ActionFeedbackService.clearLastError()
            BadgeService.setBadgeText(ExtensionBadgeTextEnum.ok)
            ActionFeedbackService.notifyBlacklistSuccess(hostname)
          })
          .catch(reason => {
            ActionFeedbackService.reportApiFailure(reason)
          })
      })
      .catch(reason => {
        ActionFeedbackService.reportApiFailure(reason)
      })
  }

  public static whitelistHostname(hostname: string): void {
    if (hostname.length < 1) {
      return
    }
    PiHoleApiService.subDomainFromList(ApiList.blacklist, hostname)
      .then(() => {
        PiHoleApiService.addDomainToList(ApiList.whitelist, hostname)
          .then(() => {
            StorageService.getReloadAfterWhitelist().then(state => {
              if (typeof state === 'undefined') {
                return
              }
              if (state) {
                TabService.reloadCurrentTab(1500)
              }
            })
            ActionFeedbackService.clearLastError()
            BadgeService.setBadgeText(ExtensionBadgeTextEnum.ok)
            ActionFeedbackService.notifyWhitelistSuccess(hostname)
          })
          .catch(reason => {
            ActionFeedbackService.reportApiFailure(reason)
          })
      })
      .catch(reason => {
        ActionFeedbackService.reportApiFailure(reason)
      })
  }

  public static blacklistCurrentDomain(): void {
    TabService.getCurrentTabUrlCleaned().then(url => {
      BackgroundService.blacklistHostname(url)
    })
  }

  public static whitelistCurrentDomain(): void {
    TabService.getCurrentTabUrlCleaned().then(url => {
      BackgroundService.whitelistHostname(url)
    })
  }

  public static blacklistDomainFromLink(linkUrl: string): void {
    TabService.getHostnameFromUrlForListing(linkUrl).then(hostname => {
      BackgroundService.blacklistHostname(hostname)
    })
  }

  public static whitelistDomainFromLink(linkUrl: string): void {
    TabService.getHostnameFromUrlForListing(linkUrl).then(hostname => {
      BackgroundService.whitelistHostname(hostname)
    })
  }

  public static openOptions(): void {
    chrome.runtime.openOptionsPage()
  }
}
