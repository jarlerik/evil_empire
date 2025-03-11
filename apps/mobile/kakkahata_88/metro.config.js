const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project root directory
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and set the root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Configure module resolution
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (name === 'expo-router') {
        return path.resolve(workspaceRoot, 'node_modules/expo-router');
      }
      return path.join(workspaceRoot, `node_modules/${name}`);
    },
  }
);

// 4. Set platforms and extensions
config.resolver.platforms = ['ios', 'android', 'web'];
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];

// 5. Additional configuration
config.resolver.disableHierarchicalLookup = true;
config.resolver.resolverMainFields = ['browser', 'main'];

module.exports = config;
