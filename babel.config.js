module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for expo-router
      'expo-router/babel',
      // Add react-native-reanimated plugin
      'react-native-reanimated/plugin',
    ],
  };
};
