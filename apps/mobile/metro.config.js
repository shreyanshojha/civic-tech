/**
 * Metro configuration.
 *
 * Two jobs beyond the Expo defaults:
 *
 * 1. WIRE @ftm/core INTO THE BUNDLE.
 *    apps/mobile is deliberately NOT an npm workspace (see README), so there is
 *    no node_modules/@ftm/core symlink to resolve. Instead Metro is told where
 *    the package lives on disk and resolves `@ftm/core` to its TypeScript
 *    SOURCE rather than its built `dist/`. Resolving to source means the mobile
 *    app never depends on `npm run build:core` having been run first, and it
 *    means there is exactly one copy of the disclaimer strings in the repo.
 *
 *    packages/core is written with NodeNext-style specifiers (`./types.js`
 *    pointing at `types.ts`). Metro does not perform that remap, so the
 *    resolver below does it — but only for requests originating inside
 *    packages/core, so nothing else in the app is affected.
 *
 * 2. WATCH THE MONOREPO. watchFolders lets Metro read files above the project
 *    root; nodeModulesPaths keeps dependency resolution pinned to
 *    apps/mobile/node_modules so nothing is accidentally hoisted in from the
 *    root install.
 */

const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const coreRoot = path.resolve(workspaceRoot, 'packages/core');
const coreSrc = path.join(coreRoot, 'src');

const config = getDefaultConfig(projectRoot);

// Metro crawls exactly these roots (metro-file-map `roots: config.watchFolders`),
// so the project root has to stay in the list when packages/core is added.
config.watchFolders = [...(config.watchFolders ?? []), projectRoot, coreRoot].filter(
  (dir, i, all) => all.indexOf(dir) === i,
);

/**
 * Turn OFF Expo's on-demand filesystem.
 *
 * When it is on, `expo export` throws `watchFolders` away and replaces it with
 * just the project root (see @expo/cli's withMetroMultiPlatform), then reads
 * everything else lazily through a fallback filesystem that is scoped to
 * `server.unstable_serverRoot`. Both halves of that break a package that lives
 * outside the project root: the crawler never indexes packages/core, and the
 * lazy fallback refuses to read above the project root, so the build dies with
 * "Failed to get the SHA-1 for: packages/core/src/index.ts".
 *
 * Switching it off restores plain crawling of `watchFolders` above. The
 * alternative — widening `server.unstable_serverRoot` to the repository root —
 * also makes Expo resolve the entry point and node_modules from the repository
 * root, which is wrong here because apps/mobile installs its own dependencies
 * instead of relying on workspace hoisting.
 */
config.resolver.unstable_onDemandFilesystem = false;

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

// Kept for parity with the documented monorepo recipe and for any tool that
// reads extraNodeModules instead of going through resolveRequest.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@ftm/core': coreRoot,
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@ftm/core' || moduleName === '@ftm/core/src') {
    return { type: 'sourceFile', filePath: path.join(coreSrc, 'index.ts') };
  }

  if (moduleName.startsWith('@ftm/core/')) {
    const sub = moduleName
      .slice('@ftm/core/'.length)
      .replace(/^src\//, '')
      .replace(/\.js$/, '');
    return { type: 'sourceFile', filePath: path.join(coreSrc, `${sub}.ts`) };
  }

  // NodeNext `./x.js` -> `./x.ts`, only inside packages/core.
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    typeof context.originModulePath === 'string' &&
    context.originModulePath.startsWith(coreSrc)
  ) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(
        path.dirname(context.originModulePath),
        moduleName.replace(/\.js$/, '.ts'),
      ),
    };
  }

  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
