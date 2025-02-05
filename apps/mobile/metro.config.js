const path = require('path');
const fs = require('fs-extra');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
// const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

config.projectRoot = projectRoot;

// hot-reload file type
// cjs is needed for superstruct: https://github.com/ianstormtaylor/superstruct/issues/404#issuecomment-800182972
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'text-js',
  'd.ts',
  'cjs',
  'min.js',
];
// https://www.npmjs.com/package/node-libs-react-native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve(
    '@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.native.js',
  ),
  fs: require.resolve('react-native-level-fs'),
  path: require.resolve('path-browserify'),
  stream: require.resolve('readable-stream'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  net: require.resolve('react-native-tcp-socket'),
  tls: require.resolve('react-native-tcp-socket'),
  zlib: require.resolve('browserify-zlib'),
};

// 1. Watch all files within the monorepo
// config.watchFolders = [workspaceRoot];
// 2. Let Metro know where to resolve packages and in what order
// config.resolver.nodeModulesPaths = [
//   path.resolve(projectRoot, 'node_modules'),
//   path.resolve(workspaceRoot, 'node_modules'),
// ];
// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
// config.resolver.disableHierarchicalLookup = true;

const fileMapCacheDirectoryPath = path.resolve(
  projectRoot,
  'node_modules',
  '.cache/file-map-cache',
);
fs.ensureDirSync(fileMapCacheDirectoryPath);
const cacheStoreDirectoryPath = path.resolve(
  projectRoot,
  'node_modules',
  '.cache/metro-cache',
);
fs.ensureDirSync(cacheStoreDirectoryPath);

config.fileMapCacheDirectory = fileMapCacheDirectoryPath;
config.cacheStores = ({ FileStore }) => [
  new FileStore({
    root: cacheStoreDirectoryPath,
  }),
];

// https://github.com/facebook/metro/issues/1191
// Lazy compilation is unstable and can easily lead to 'Reached heap limit Allocation failed.

// @expo/metro-config/build/rewriteRequestUrl.js
// metro includes rewriteExpoRequestUrl function which is used to rewrite the request url.
const orignalRewriteRequestUrl = config.server.rewriteRequestUrl
  ? config.server.rewriteRequestUrl
  : (url) => url;
config.server.rewriteRequestUrl = (url) =>
  orignalRewriteRequestUrl(url).replace('&lazy=true', '&lazy=false');

const splitCodePlugin = require('./plugins');

module.exports = splitCodePlugin(config, projectRoot);
