module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      'babel-preset-expo',
    ],
    plugins: [
      // Required for WatermelonDB decorators
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  }
}
