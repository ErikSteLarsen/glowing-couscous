import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(projectRoot, "prisma/schema.prisma");

function normalizeSchema(schema) {
  return schema
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/("(?:\\.|[^"\\])*")|\s+/g, (match, quotedString) => quotedString ?? " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function generatedClientIsCurrent() {
  let clientEntry;

  try {
    clientEntry = require.resolve("@prisma/client");
  } catch {
    return false;
  }

  const generatedClientPath = resolve(dirname(clientEntry), "../../.prisma/client");
  const generatedSchemaPath = resolve(generatedClientPath, "schema.prisma");

  if (!existsSync(generatedSchemaPath)) {
    return false;
  }

  const generatedFiles = readdirSync(generatedClientPath);
  const usesClientEngine = /\bengineType\s*=\s*"client"/.test(
    readFileSync(schemaPath, "utf8"),
  );
  const hasQueryEngine = generatedFiles.some((file) =>
    /^(?:(?:lib)?query_engine-.+\.(?:dll\.node|so\.node|dylib\.node)|query-engine-.+(?:\.exe)?)$/.test(
      file,
    ),
  );

  if (!usesClientEngine && !hasQueryEngine) {
    return false;
  }

  return (
    normalizeSchema(readFileSync(schemaPath, "utf8")) ===
    normalizeSchema(readFileSync(generatedSchemaPath, "utf8"))
  );
}

if (generatedClientIsCurrent()) {
  console.log("Prisma Client matches the schema; reusing the generated client.");
  process.exit(0);
}

console.log("Prisma Client is missing or out of date; generating it from the schema.");

let prismaCli;

try {
  const prismaPackagePath = require.resolve("prisma/package.json");
  const prismaPackage = JSON.parse(readFileSync(prismaPackagePath, "utf8"));
  const prismaBin =
    typeof prismaPackage.bin === "string"
      ? prismaPackage.bin
      : prismaPackage.bin?.prisma;

  if (!prismaBin) {
    throw new Error("The Prisma package does not declare a CLI executable.");
  }

  prismaCli = resolve(dirname(prismaPackagePath), prismaBin);
  if (!existsSync(prismaCli)) {
    throw new Error(`The Prisma CLI executable was not found at ${prismaCli}.`);
  }
} catch (error) {
  console.error("Unable to locate the Prisma CLI.", error);
  process.exit(1);
}

const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (result.error) {
  console.error("Unable to run Prisma Client generation.", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
