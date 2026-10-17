import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(root, "index.html");
const calculatorPath = join(root, "calculator.mjs");
const appPath = join(root, "app.js");
const outputPath = join(root, "recipe-calculator.html");

async function readJsonDirectory(directory) {
  const absoluteDirectory = join(root, directory);
  const entries = (await readdir(absoluteDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const result = {};
  for (const entry of entries) {
    const contents = await readFile(join(absoluteDirectory, entry.name), "utf8");
    result[entry.name] = JSON.parse(contents);
  }
  return result;
}

let html = await readFile(htmlPath, "utf8");
const css = await readFile(join(root, "styles.css"), "utf8");
const calculator = (await readFile(calculatorPath, "utf8"))
  .replace(/^export function /gm, "function ")
  .replace(/export \{[^}]+\};?\s*$/gm, "");
const app = (await readFile(appPath, "utf8"))
  .replace(/^import .*?;\s*$/gm, "")
  .replace("const { calculateRequirements, normalizeMaterialName } = RecipeCalculator;", "");
const embeddedData = JSON.stringify({
  recipe: await readJsonDirectory("recipe"),
  material: await readJsonDirectory("material"),
});
const applicationScript = `    <script>
      window.RECIPE_DATA = ${embeddedData};
    </script>
    <script>
${calculator}
      const RecipeCalculator = { calculateRequirements, normalizeMaterialName };
${app}
    </script>`;

html = html.replace(
  '    <link rel="stylesheet" href="./styles.css">',
  `    <style>\n${css}\n    </style>`,
);
html = html.replace(
  '    <script type="module" src="./app.js"></script>',
  "",
);
html = html.replace("</body>", `${applicationScript}\n  </body>`);

if (html.includes("./styles.css") || html.includes("./app.js") || html.includes("RECIPE_DATA = undefined")) {
  throw new Error("Standalone build still references external app assets");
}
await writeFile(outputPath, html, "utf8");
console.log(`Built ${outputPath}`);
