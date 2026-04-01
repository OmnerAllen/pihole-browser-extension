import axios, { AxiosResponse } from 'axios'
import { PiHoleApiStatus } from '../api/models/PiHoleApiStatus'
import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import { BadgeService, ExtensionBadgeTextEnum } from './BadgeService'
import { StorageService } from './StorageService'
import { I18NNotificationKeys, I18NService } from './i18NService'

export default class ActionFeedbackService {
  public static reportApiFailure(reason: unknown): void {
    const msg = this.formatReason(reason)
    console.warn(msg, reason)
    BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
    StorageService.saveLastApiError(msg)
    this.notifyIfEnabled(
      I18NService.translate(I18NNotificationKeys.notification_error_generic_title),
      msg
    ).catch(() => {})
  }

  public static clearLastError(): void {
    StorageService.clearLastApiError()
  }

  public static validateToggleResponses(
    responses: AxiosResponse<PiHoleApiStatus>[],
    expectedMode: PiHoleApiStatusEnum
  ): boolean {
    for (let i = 0; i < responses.length; i += 1) {
      const piHoleStatus = responses[i]
      const { blocking } = piHoleStatus.data

      if (blocking === PiHoleApiStatusEnum.error) {
        const msg = I18NService.translate(
          I18NNotificationKeys.notification_toggle_api_error_detail,
          String(i + 1)
        )
        console.warn(msg, {
          index: i,
          response: piHoleStatus.data,
          baseURL: piHoleStatus.config?.baseURL
        })
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
        StorageService.saveLastApiError(msg)
        this.notifyIfEnabled(
          I18NService.translate(
            I18NNotificationKeys.notification_toggle_api_error_title
          ),
          msg
        ).catch(() => {})
        return false
      }

      if (blocking !== expectedMode) {
        const msg = I18NService.translate(
          I18NNotificationKeys.notification_toggle_status_mismatch_detail,
          [String(i + 1), String(expectedMode), String(blocking)]
        )
        console.warn(msg, {
          index: i,
          response: piHoleStatus.data,
          expected: expectedMode,
          actual: blocking
        })
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
        StorageService.saveLastApiError(msg)
        this.notifyIfEnabled(
          I18NService.translate(
            I18NNotificationKeys.notification_toggle_status_mismatch_title
          ),
          msg
        ).catch(() => {})
        return false
      }
    }
    return true
  }

  public static notifyToggleSuccess(enabled: boolean): void {
    const title = enabled
      ? I18NService.translate(I18NNotificationKeys.notification_toggle_enabled_title)
      : I18NService.translate(I18NNotificationKeys.notification_toggle_disabled_title)
    const body = enabled
      ? I18NService.translate(I18NNotificationKeys.notification_toggle_enabled_body)
      : I18NService.translate(I18NNotificationKeys.notification_toggle_disabled_body)
    this.notifyIfEnabled(title, body).catch(() => {})
  }

  public static notifyBlacklistSuccess(hostname: string): void {
    this.notifyIfEnabled(
      I18NService.translate(I18NNotificationKeys.notification_blacklist_success_title),
      I18NService.translate(
        I18NNotificationKeys.notification_blacklist_success_body,
        hostname
      )
    ).catch(() => {})
  }

  public static notifyWhitelistSuccess(hostname: string): void {
    this.notifyIfEnabled(
      I18NService.translate(I18NNotificationKeys.notification_whitelist_success_title),
      I18NService.translate(
        I18NNotificationKeys.notification_whitelist_success_body,
        hostname
      )
    ).catch(() => {})
  }

  public static formatReason(reason: unknown): string {
    if (axios.isAxiosError(reason)) {
      const data = reason.response?.data
      if (data !== undefined) {
        try {
          return typeof data === 'string' ? data : JSON.stringify(data)
        } catch {
          return reason.message
        }
      }
      return reason.message || 'Request failed'
    }
    if (typeof reason === 'string') {
      return reason
    }
    if (reason instanceof Error) {
      return reason.message
    }
    try {
      return JSON.stringify(reason)
    } catch {
      return 'Unknown error'
    }
  }

  private static async notifyIfEnabled(
    title: string,
    message: string
  ): Promise<void> {
    const enabled = await StorageService.getEnableActionNotifications()
    if (!enabled) {
      return
    }
    const id = `pihole-ext-${Date.now()}`
    try {
      const iconUrl = chrome.runtime.getURL('icon/icon-48.png')
      chrome.notifications.create(id, {
        type: 'basic',
        iconUrl,
        title,
        message
      })
    } catch (e) {
      console.warn('Could not show notification', e)
    }
  }
}
