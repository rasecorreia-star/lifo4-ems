module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@screens': './src/screens',
            '@components': './src/components',
            '@navigation': './src/navigation',
            '@services': './src/services',
            '@store': './src/store',
            '@utils': './src/utils',
            '@hooks': './src/hooks',
            '@assets': './assets',
          },
        },
      ],
    ],
  };
};
