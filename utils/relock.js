import { readdirSync, rmSync, statSync } from "node:fs";

function readDirs(baseDir) {
    return readdirSync(baseDir)
        .filter(dir => !dir.startsWith(".") && statSync(`${baseDir}/${dir}`).isDirectory())
        .map(dir => `${baseDir}/${dir}`);
}

rmSync("package-lock.json", { force: true });

[".", ...readDirs("packages")].forEach(dir => rmSync(`${dir}/node_modules`, { recursive: true, force: true }));
