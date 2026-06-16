import { cpSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "frontend/admin-dashboard/dist");
const admin = resolve(root, "frontend/admin");

rmSync(admin, { recursive: true, force: true });
cpSync(dist, admin, { recursive: true });

console.log("Copied admin dashboard build to frontend/admin/");
