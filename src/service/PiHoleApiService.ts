import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { PiHoleApiStatus } from '../api/models/PiHoleApiStatus'
import { PiHoleSettingsStorage, StorageService } from './StorageService'
import { PiHoleVersionsV6 } from '../api/models/PiHoleVersions'
import ApiListMode from '../api/enum/ApiListMode'
import ApiList from '../api/enum/ApiList'
import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import { PiHoleAuth } from '../api/models/PiHoleAuth'
import { PiHoleDomains } from '../api/models/PiHoleDomains'

export default class PiHoleApiService {
  public static async getPiHoleStatusCombined(): Promise<PiHoleApiStatusEnum> {
    return new Promise<PiHoleApiStatusEnum>(resolve => {
      this.getPiHoleStatus()
        .then(results => {
          // helper: normalize various API responses to our enum
          const normalizeBlocking = (blocking: any): PiHoleApiStatusEnum => {
            if (blocking === true || blocking === 'true' || blocking === 1 || blocking === '1') {
              return PiHoleApiStatusEnum.enabled
            }
            if (blocking === false || blocking === 'false' || blocking === 0 || blocking === '0') {
              return PiHoleApiStatusEnum.disabled
            }
            if (typeof blocking === 'string') {
              const b = blocking.toLowerCase()
              if (b === 'enabled' || b === 'enable' || b === 'on') return PiHoleApiStatusEnum.enabled
              if (b === 'disabled' || b === 'disable' || b === 'off') return PiHoleApiStatusEnum.disabled
              if (b === 'error' || b === 'failed') return PiHoleApiStatusEnum.error
            }
            return PiHoleApiStatusEnum.error
          }

          for (const result of results) {
            const resultData = result.data
            const status = normalizeBlocking(resultData.blocking)
            // If any PiHole is offline or has an error we use its status
            if (status === PiHoleApiStatusEnum.error || status === PiHoleApiStatusEnum.disabled) {
              resolve(status)
              return
            }
          }

          resolve(PiHoleApiStatusEnum.enabled)
        })
        .catch(reason => {
          console.warn('getPiHoleStatus error:', reason)
          if (reason.response) {
            console.warn('Response data:', reason.response.data)
            console.warn('Response status:', reason.response.status)
          }
          resolve(PiHoleApiStatusEnum.error)
        })
    })
  }

  public static async getPiHoleStatus(): Promise<
    AxiosResponse<PiHoleApiStatus>[]
  > {
    const piHoleSettingsArray = await StorageService.getPiHoleSettingsArray()
    if (typeof piHoleSettingsArray === 'undefined') {
      return Promise.reject('PiHoleSettings empty')
    }

    const promiseArray = new Array<Promise<AxiosResponse<PiHoleApiStatus>>>()

    for (const piHole of piHoleSettingsArray) {
      if (
        typeof piHole.pi_uri_base === 'undefined' ||
        typeof piHole.api_key === 'undefined'
      ) {
        return Promise.reject('Some PiHoleSettings are undefined.')
      }

      promiseArray.push(
        this.getAxiosInstance(piHole.pi_uri_base, piHole.api_key).get<
          PiHoleApiStatus
        >('/dns/blocking')
      )
    }

    return Promise.all(promiseArray)
  }

  public static async getPiHoleVersion(
    piHole: PiHoleSettingsStorage
  ): Promise<AxiosResponse<PiHoleVersionsV6>> {
    if (
      typeof piHole.pi_uri_base === 'undefined' ||
      typeof piHole.api_key === 'undefined'
    ) {
      return Promise.reject('Some PiHoleSettings are undefined.')
    }

    return this.getAxiosInstance(piHole.pi_uri_base, piHole.api_key).get<
      PiHoleVersionsV6
    >('/info/version')
  }

  public static async changePiHoleStatus(
    mode: PiHoleApiStatusEnum,
    time: number
  ): Promise<AxiosResponse<PiHoleApiStatus>[]> {
    const piHoleSettingsArray = await StorageService.getPiHoleSettingsArray()
    if (typeof piHoleSettingsArray === 'undefined') {
      return Promise.reject('PiHoleSettings empty')
    }

    if (time < 0) {
      return Promise.reject(`Disable time smaller than allowed:${time}`)
    }

    const promiseArray = new Array<Promise<AxiosResponse<PiHoleApiStatus>>>()

    for (const piHole of piHoleSettingsArray) {
      if (
        typeof piHole.pi_uri_base === 'undefined' ||
        typeof piHole.api_key === 'undefined'
      ) {
        return Promise.reject('Some PiHoleSettings are undefined.')
      }

      let blocking
      if (mode === PiHoleApiStatusEnum.disabled) {
        blocking = false
      } else if (mode === PiHoleApiStatusEnum.enabled) {
        blocking = true
      } else {
        return Promise.reject(`Mode ${mode} not allowed for this function.`)
      }

      promiseArray.push(
        this.getAxiosInstance(piHole.pi_uri_base, piHole.api_key).post<
          PiHoleApiStatus
        >('/dns/blocking', {
          blocking,
          timer: time === 0 || blocking ? null : time
        })
      )
    }

    return Promise.all(promiseArray)
  }

  public static async addDomainToList(
    list: ApiList,
    domain: string
  ): Promise<AxiosResponse<PiHoleDomains>[]> {
    return this.changeDomainOnList(list, ApiListMode.add, domain)
  }

  public static async subDomainFromList(
    list: ApiList,
    domain: string
  ): Promise<AxiosResponse<PiHoleDomains>[]> {
    return this.changeDomainOnList(list, ApiListMode.sub, domain)
  }

  private static async changeDomainOnList(
    list: ApiList,
    mode: ApiListMode,
    domain: string
  ): Promise<AxiosResponse<PiHoleDomains>[]> {
    const piHoleSettingsArray = await StorageService.getPiHoleSettingsArray()

    if (typeof piHoleSettingsArray === 'undefined') {
      return Promise.reject('PiHoleSettings empty')
    }

    if (domain.length < 1) {
      return Promise.reject("Domain can't be empty")
    }

    const promiseArray = new Array<Promise<AxiosResponse<PiHoleDomains>>>()

    for (const piHole of piHoleSettingsArray) {
      if (
        typeof piHole.pi_uri_base === 'undefined' ||
        typeof piHole.api_key === 'undefined'
      ) {
        return Promise.reject('Some PiHoleSettings are undefined.')
      }

      const addPromise = () =>
        this.getAxiosInstance(piHole.pi_uri_base!, piHole.api_key)
          .post<PiHoleDomains>(`/domains/${list}/exact`, {
            domain,
            comment: 'From PiHole Extension',
            groups: [0],
            enabled: true
          })
          .catch(
            // Sub can fail if the domain is not in the list
            // We can ignore this error
            reason => {
              console.warn(reason)
              return reason
            }
          )
      const subPromise = () =>
        this.getAxiosInstance(piHole.pi_uri_base!, piHole.api_key)
          .delete<PiHoleDomains>(`/domains/${list}/exact/${domain}`)
          .catch(
            // Sub can fail if the domain is not in the list
            // We can ignore this error
            reason => {
              console.warn(reason)
              return reason
            }
          )

      promiseArray.push(mode === ApiListMode.add ? addPromise() : subPromise())
    }

    return Promise.all(promiseArray)
  }

  private static createAxiosBaseInstance(domain: string): AxiosInstance {
    return axios.create({
      baseURL: new URL('/api', new URL(domain)).toString(),
      adapter: 'fetch',
      withCredentials: false
    })
  }

  private static getAxiosInstance(
    domain: string,
    apiKey?: string
  ): AxiosInstance {
    const instance = this.createAxiosBaseInstance(domain)

    const acquireSid = async () => {
      const axiosInstance = this.createAxiosBaseInstance(domain)

      const auth = await axiosInstance.post<PiHoleAuth>('/auth', {
        password: apiKey
      })

      return auth.data.session
    }

    instance.interceptors.request.use(async config => {
      // No API key, no need to add it to the headers
      if (!apiKey) {
        return config
      }

      const sid = await StorageService.getSid(domain)
      if (sid) {
        // eslint-disable-next-line no-param-reassign
        config.headers['X-FTL-SID'] = sid
        return config
      }

      const session = await acquireSid()
      await StorageService.saveSid(domain, session.sid)
      // eslint-disable-next-line no-param-reassign
      config.headers['X-FTL-SID'] = session.sid

      return config
    })

    // Response interceptor to handle session expiration
    instance.interceptors.response.use(undefined, async error => {
      const isAuthRoute = error.config.url === '/auth'
      if (error.response?.status === 401 && !isAuthRoute) {
        console.warn('Session expired, acquiring new session')
        const session = await acquireSid()
        await StorageService.saveSid(domain, session.sid)
        // eslint-disable-next-line no-param-reassign
        error.config.headers['X-FTL-SID'] = session.sid
        return axios.request(error.config)
      }
      return Promise.reject(error)
    })

    return instance
  }
}
