// Where: Electron Forge configuration. What: build, sign, and notarize the macOS app when credentials are provided. Why: provide a distributable cctimer bundle without committing secrets.

const hasSigningIdentity = Boolean(process.env.CSC_NAME);
const hasNotarizationCredentials = Boolean(
  process.env.APPLE_ID &&
  process.env.APPLE_ID_PASSWORD &&
  process.env.APPLE_TEAM_ID
);

module.exports = {
  packagerConfig: {
    appBundleId: 'com.yukikimura.cctimer',
    appCategoryType: 'public.app-category.developer-tools',
    asar: false,
    executableName: 'cctimer',
    icon: undefined,
    ...(hasSigningIdentity
      ? {
          osxSign: {
            identity: process.env.CSC_NAME,
            hardenedRuntime: true
          }
        }
      : {}),
    ...(hasSigningIdentity && hasNotarizationCredentials
      ? {
          osxNotarize: {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID
          }
        }
      : {}),
    ignore: [
      /^\/out($|\/)/,
      /^\/release($|\/)/,
      /^\/\.git($|\/)/,
      /^\/\.gitignore$/,
      /^\/forge\.config\.js$/,
      /^\/package-lock\.json$/,
      /^\/README\.md$/
    ]
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    }
  ]
};
