const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// 1. Watch all files within the monorepo (merge with Expo defaults)
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Keep hierarchical lookup enabled (Expo default) since nodeModulesPaths handles resolution order
config.resolver.disableHierarchicalLookup = false;

// 4. Add support for additional file extensions if needed
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// 5. Custom resolver for React Native and workspace packages
config.resolver.extraNodeModules = {
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle workspace packages
  if (moduleName.startsWith('@evil-empire/')) {
    const packageName = moduleName.replace('@evil-empire/', '');
    const packagePath = path.resolve(workspaceRoot, 'packages', packageName, 'src');
    return {
      filePath: path.resolve(packagePath, 'index.ts'),
      type: 'sourceFile',
    };
  }

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

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
