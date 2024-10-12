import { join } from "@std/path";

const distDir = join(Deno.cwd(), "dist");

try {
  await Deno.stat(distDir);
} catch {
  console.log("missing ./dist folder");
  Deno.exit(1);
}

async function getFilePaths(dir: string) {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isDirectory) {
      const nestedFiles = await getFilePaths(join(dir, entry.name));
      files.push(...nestedFiles);
    } else {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

const files = await getFilePaths(distDir);

for (const filepath of files) {
  let content = await Deno.readTextFile(filepath);
  content = content.replaceAll('"react"', '"preact/compat"');
  await Deno.writeTextFile(filepath, content);
}
