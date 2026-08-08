// Where: Electron Forge configuration. What: build a macOS app and zip archive. Why: provide a distributable cctimer bundle.

module.exports = {
  packagerConfig: {
    asar: false,
    executableName: 'cctimer',
    icon: undefined,
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
