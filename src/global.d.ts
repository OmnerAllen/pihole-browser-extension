/* eslint-disable @typescript-eslint/naming-convention, no-underscore-dangle -- webpack DefinePlugin global */
/** Injected by webpack DefinePlugin (see WebpackConfigFactory). */
declare const __LOCAL_BUILD_VERSION__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}
