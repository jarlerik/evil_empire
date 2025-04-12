const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// Add custom configuration for React Native new architecture
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    'react-native': require.resolve('react-native'),
    'react': require.resolve('react'),
    'react-dom': require.resolve('react-dom'),
  },
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'react-native/Libraries/Renderer/shims/ReactNative') {
      return {
        filePath: require.resolve('react-native/Libraries/Renderer/shims/ReactNative'),
        type: 'sourceFile',
      };
    }
    if (moduleName === 'react-native/Libraries/Renderer/shims/ReactFabric') {
      return {
        filePath: require.resolve('react-native/Libraries/Renderer/shims/ReactFabric'),
        type: 'sourceFile',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
