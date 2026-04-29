import fs from "node:fs";
import path from "node:path";

function collectFirebaseAdminHashedPackages() {
  const root = process.cwd();
  const nextServerDir = path.join(root, ".next", "server");
  const results = new Set();

  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && (ent.name.endsWith(".json") || ent.name.endsWith(".js"))) {
        try {
          const s = fs.readFileSync(full, "utf8");
          const matches = s.match(/firebase-admin-[a-f0-9]{6,}/g);
          if (matches) for (const m of matches) results.add(m);
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  walk(nextServerDir);
  return Array.from(results);
}

function ensureShimPackage(pkgName) {
  const root = process.cwd();
  const dir = path.join(root, "node_modules", pkgName);

  fs.mkdirSync(dir, { recursive: true });

  const pkgJson = {
    name: pkgName,
    private: true,
    type: "module",
    exports: {
      ".": "./index.js",
      "./app": "./app.js",
      "./auth": "./auth.js",
      "./firestore": "./firestore.js",
      "./storage": "./storage.js",
    },
  };

  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkgJson, null, 2));

  fs.writeFileSync(
    path.join(dir, "index.js"),
    [
      'export * from "firebase-admin";',
      'import admin from "firebase-admin";',
      "export default admin;",
      "",
    ].join("\n"),
  );

  fs.writeFileSync(
    path.join(dir, "app.js"),
    ['export * from "firebase-admin/app";', ""].join("\n"),
  );
  fs.writeFileSync(
    path.join(dir, "auth.js"),
    ['export * from "firebase-admin/auth";', ""].join("\n"),
  );
  fs.writeFileSync(
    path.join(dir, "firestore.js"),
    ['export * from "firebase-admin/firestore";', ""].join("\n"),
  );
  fs.writeFileSync(
    path.join(dir, "storage.js"),
    ['export * from "firebase-admin/storage";', ""].join("\n"),
  );
}

const pkgs = collectFirebaseAdminHashedPackages();
if (pkgs.length === 0) {
  console.log("[fix-turbopack-firebase-admin] no hashed packages found");
  process.exit(0);
}

for (const p of pkgs) ensureShimPackage(p);

console.log(
  `[fix-turbopack-firebase-admin] created ${pkgs.length} shim package(s): ${pkgs.join(", ")}`,
);

