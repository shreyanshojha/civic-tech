/**
 * babel-preset-expo handles TypeScript, JSX and the expo-router plugin. It is
 * also what transpiles packages/core's TypeScript sources, which Metro pulls in
 * from outside this project root (see metro.config.js).
 */
module.exports = function (api) {
  api.cache(true);
  return { presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]] };
};
