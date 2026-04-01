<template>
  <div class="list-card-root">
    <v-card class="list-card" flat>
    <v-card-text class="pa-4">
      <div class="list-card__label">
        {{ translate(I18NPopupKeys.popup_second_card_current_url) }}
      </div>
      <div class="url-pill">
        {{ currentUrl }}
      </div>
      <div class="list-card__actions">
        <v-btn
          id="list_action_white"
          :disabled="buttonsDisabled"
          :title="translate(I18NPopupKeys.popup_second_card_whitelist)"
          color="success"
          rounded
          depressed
          :loading="whitelistingActive"
          class="list-card__btn"
          @click="whitelistUrl"
        >
          <v-icon left small>{{ mdiCheckCircleOutline }}</v-icon>
          {{ translate(I18NPopupKeys.popup_second_card_whitelist) }}
        </v-btn>
        <v-btn
          id="list_action_black"
          :disabled="buttonsDisabled"
          :title="translate(I18NPopupKeys.popup_second_card_blacklist)"
          color="error"
          rounded
          depressed
          :loading="blacklistingActive"
          class="list-card__btn"
          @click="blackListUrl"
        >
          <v-icon left small>{{ mdiAlphaXCircleOutline }}</v-icon>
          {{ translate(I18NPopupKeys.popup_second_card_blacklist) }}
        </v-btn>
      </div>
    </v-card-text>
    </v-card>

    <transition name="list-toast-fade">
      <div
        v-if="successToastVisible && successMessage"
        class="list-toast"
        role="status"
        aria-live="polite"
      >
        {{ successMessage }}
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { mdiAlphaXCircleOutline, mdiCheckCircleOutline } from '@mdi/js'
import { defineComponent, ref } from '@vue/composition-api'
import PiHoleApiService from '../../../../service/PiHoleApiService'
import ApiList from '../../../../api/enum/ApiList'
import useTranslation from '../../../../hooks/translation'
import ActionFeedbackService from '../../../../service/ActionFeedbackService'
import { BadgeService, ExtensionBadgeTextEnum } from '../../../../service/BadgeService'
import { I18NNotificationKeys, I18NService } from '../../../../service/i18NService'

export default defineComponent({
  name: 'PopupListCardComponent',
  props: {
    currentUrl: {
      type: String,
      required: true
    }
  },
  setup: ({ currentUrl }) => {
    const formatListSuccessLine = (
      messageKey: I18NNotificationKeys,
      url: string,
      listKind: 'whitelist' | 'blacklist'
    ): string => {
      const fromLocale = I18NService.translate(messageKey, url).trim()
      if (fromLocale.length > 0) {
        return fromLocale
      }
      return listKind === 'whitelist'
        ? `${url} was added to the whitelist.`
        : `${url} was added to the blacklist.`
    }

    const buttonsDisabled = ref(false)
    const whitelistingActive = ref(false)
    const blacklistingActive = ref(false)
    const successToastVisible = ref(false)
    const successMessage = ref('')
    let successToastTimer: ReturnType<typeof setTimeout> | undefined

    const listDomain = async (mode: ApiList) => {
      if (!currentUrl) {
        return
      }

      buttonsDisabled.value = true

      if (mode === ApiList.whitelist) {
        whitelistingActive.value = true
      } else {
        blacklistingActive.value = true
      }

      // We remove the domain from the opposite list
      try {
        await PiHoleApiService.subDomainFromList(
          mode === ApiList.whitelist ? ApiList.blacklist : ApiList.whitelist,
          currentUrl
        )

        await PiHoleApiService.addDomainToList(mode, currentUrl)

        ActionFeedbackService.clearLastError()
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.ok)
        if (mode === ApiList.whitelist) {
          successMessage.value = formatListSuccessLine(
            I18NNotificationKeys.notification_whitelist_success_body,
            currentUrl,
            'whitelist'
          )
          ActionFeedbackService.notifyWhitelistSuccess(currentUrl)
        } else {
          successMessage.value = formatListSuccessLine(
            I18NNotificationKeys.notification_blacklist_success_body,
            currentUrl,
            'blacklist'
          )
          ActionFeedbackService.notifyBlacklistSuccess(currentUrl)
        }
        if (successToastTimer !== undefined) {
          clearTimeout(successToastTimer)
        }
        successToastVisible.value = true
        successToastTimer = setTimeout(() => {
          successToastVisible.value = false
          successToastTimer = undefined
        }, 3500)
      } catch (reason) {
        ActionFeedbackService.reportApiFailure(reason)
      }

      setTimeout(() => {
        whitelistingActive.value = false
        blacklistingActive.value = false
        buttonsDisabled.value = false
      }, 1500)
    }

    const whitelistUrl = () => {
      listDomain(ApiList.whitelist)
    }

    const blackListUrl = () => {
      listDomain(ApiList.blacklist)
    }

    return {
      whitelistingActive,
      blacklistingActive,
      successToastVisible,
      successMessage,
      buttonsDisabled,
      mdiCheckCircleOutline,
      mdiAlphaXCircleOutline,
      whitelistUrl,
      blackListUrl,
      ...useTranslation()
    }
  }
})
</script>

<style lang="scss" scoped>
.list-card-root {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* In-flow strip below the card so it never covers the Whitelist/Blacklist buttons */
.list-toast {
  margin: 10px 2px 0;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  color: #fff !important;
  text-align: center;
  word-break: break-word;
  border-radius: 8px;
  background: #2e7d32;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.list-toast-fade-enter-active,
.list-toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.list-toast-fade-enter,
.list-toast-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
