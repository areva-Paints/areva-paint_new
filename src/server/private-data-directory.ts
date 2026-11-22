/* Resolve both existing and future directories through symlinked ancestors before
 * mounting public assets. A lexical path check alone can expose private records
 * when CONTENT_DATA_DIR is an alias for a public directory.
 */
import fs from "node:fs";
import path from "node:path";

function physicalLocation(location: string, seen = new Set<string>()): string {
  let ancestor = path.resolve(location);
  const remaining: string[] = [];
  while (true) {
    try {
      const entry = fs.lstatSync(ancestor);
      if (entry.isSymbolicLink()) {
        if (seen.has(ancestor))
          throw Error("A data-directory symlink is circular");
        seen.add(ancestor);
        const target = path.resolve(
          path.dirname(ancestor),
          fs.readlinkSync(ancestor),
        );
        return path.join(physicalLocation(target, seen), ...remaining);
      }
      return path.join(fs.realpathSync(ancestor), ...remaining);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      remaining.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
}

/* Reject any physical overlap with a public static/source root before startup. */
export function assertPrivateDataDirectory(
  directory: string,
  applicationRoot: string,
): string {
  const physical = physicalLocation(directory);
  for (const name of ["public", "dist", "src"]) {
    const relative = path.relative(
      physicalLocation(path.join(applicationRoot, name)),
      physical,
    );
    if (
      relative === "" ||
      (!relative.startsWith(".." + path.sep) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    )
      throw Error(
        "CONTENT_DATA_DIR must be outside public, dist and src, including symlink targets.",
      );
  }
  if (fs.existsSync(directory) && !fs.statSync(directory).isDirectory())
    throw Error("CONTENT_DATA_DIR must name a private directory.");
  if (
    physicalLocation(path.join(directory, "uploads")) !==
    path.join(physical, "uploads")
  )
    throw Error(
      "Public upload storage must not be a symlink to another directory.",
    );
  return physical;
}

/* Vite serves source files in development. Deny both aliases and real storage
 * paths, escaping literal glob characters in an operator's directory name.
 */
export function privateDataDenyPatterns(directory: string): string[] {
  return [
    ...new Set([path.resolve(directory), physicalLocation(directory)]),
  ].map(
    (location) =>
      location.replaceAll(path.sep, "/").replace(/([*?{}[\]()!+@])/g, "\\$1") +
      "/**",
  );
}
