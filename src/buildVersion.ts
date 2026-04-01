/**
 * Label shown in the popup footer (e.g. "v12"). Set at compile time from
 * `local-build-version.json` after `scripts/increment-local-build.js` runs on `npm run build`.
 */
export default function getLocalBuildVersionLabel(): string {
  return __LOCAL_BUILD_VERSION__
}
