const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [...(config.watchFolders || []), monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Keep hierarchical lookup enabled
config.resolver.disableHierarchicalLookup = false;

// 4. Add support for additional file extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// 5. Custom resolver for workspace packages
config.resolver.extraNodeModules = {
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  react: path.resolve(projectRoot, 'node_modules/react'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Resolve @evil-empire/ui directly to source for live development
  if (moduleName === '@evil-empire/ui') {
    const uiSrcPath = path.resolve(projectRoot, '..', 'src');
    return {
      filePath: path.resolve(uiSrcPath, 'index.ts'),
      type: 'sourceFile',
    };
  }

  // Resolve other @evil-empire/* packages from packages/ directory
  if (moduleName.startsWith('@evil-empire/')) {
    const packageName = moduleName.replace('@evil-empire/', '');
    const packagePath = path.resolve(monorepoRoot, 'packages', packageName, 'src');
    return {
      filePath: path.resolve(packagePath, 'index.ts'),
      type: 'sourceFile',
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
