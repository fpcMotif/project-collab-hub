import fs from "node:fs";

import { globSync } from "glob";

const processFile = (filePath) => {
  if (!fs.existsSync(filePath)) {return;}
  let content = fs.readFileSync(filePath, "utf8");
  if (content.includes("import/no-unresolved")) {
    content = content.replaceAll(
      /"import\/no-unresolved"\s*:\s*"[^"]*",?\n?/g,
      ""
    );
    fs.writeFileSync(filePath, content);
  }
};

try {
  const files = globSync("node_modules/**/.oxlintrc.json", { dot: true });
  for (const file of files) {
    processFile(file);
  }
} catch (error) {
  console.error("Failed to patch oxlint configs", error);
}
