import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(path));
    else if (!path.endsWith("/sw.js") && !path.endsWith(".map")) result.push(path);
  }
  return result;
}
const paths = (await files("dist")).sort();
const hash = createHash("sha256");
hash.update(await readFile("public/sw.js"));
for (const path of paths) hash.update(await readFile(path));
const version = `retirementreadiness-shell-${hash.digest("hex").slice(0, 12)}`;
const source = (await readFile("public/sw.js", "utf8"))
  .replace("__CACHE_VERSION__", version)
  .replace("__PRECACHE__", JSON.stringify(paths.map(path => `./${path.slice(5)}`)));
await writeFile("dist/sw.js", source);
console.log(`Offline shell: ${paths.length} assets, ${version}`);
