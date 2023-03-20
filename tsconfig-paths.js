const tsConfig = require('./tsconfig.json');
const tsConfigPaths = require('tsconfig-paths');

let { baseUrl, paths } = tsConfig.compilerOptions;

console.log(paths)
// Replacing "src" by "dist" in typescript paths map
for (path in paths) {
  paths[path] = paths[path].map((path) => path.replace("src", "dist/src"));
}

tsConfigPaths.register({ baseUrl, paths });