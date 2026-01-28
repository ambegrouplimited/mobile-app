#!/usr/bin/env node

/**
 * Print the redirect URI used by Expo AuthSession.
 *
 * Usage:
 *   node scripts/show-redirect.js            # Expo proxy redirect (needs expo owner)
 *   node scripts/show-redirect.js --native   # Native/standalone redirect
 *   node scripts/show-redirect.js --owner=myusername   # override expo owner
 */

const fs = require("node:fs");
const path = require("node:path");

function stripJsonComments(str) {
  return str.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseArgs() {
  const args = {
    native: false,
    owner: process.env.EXPO_OWNER || null,
  };
  process.argv.slice(2).forEach((arg) => {
    if (arg === "--native") {
      args.native = true;
    } else if (arg.startsWith("--owner=")) {
      args.owner = arg.split("=")[1];
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/show-redirect.js [--native] [--owner=username]",
      );
      process.exit(0);
    }
  });
  return args;
}

function readExpoConfig() {
  const appJsonPath = path.join(process.cwd(), "app.json");
  const raw = fs.readFileSync(appJsonPath, "utf8");
  const parsed = JSON.parse(stripJsonComments(raw));
  return parsed.expo || {};
}

function main() {
  const args = parseArgs();
  const config = readExpoConfig();
  const slug = config.slug || "app";
  const scheme = config.scheme || "ambeduesoon";
  const owner = args.owner || config.owner;

  if (args.native) {
    console.log(`${scheme}://`);
    return;
  }

  if (!owner) {
    console.error(
      "Unable to determine Expo account owner. Pass --owner=<username> or set EXPO_OWNER.",
    );
    process.exit(1);
  }

  console.log(`https://auth.expo.io/@${owner}/${slug}`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
