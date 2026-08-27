const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
      // babel-preset-expo only adds this plugin when `require.resolve('expo-router')`
      // succeeds from *its* install location. In this npm workspace the preset is
      // hoisted to the repo root and expo-router stays under apps/mobile, so the
      // preset skips it — Metro then leaves `process.env.EXPO_ROUTER_APP_ROOT` in
      // `_ctx.ios.js` / `_ctx.android.js` and `export:embed` fails with "Invalid call".
      expoRouterBabelPlugin,
      'react-native-reanimated/plugin',
    ],
  };
};
