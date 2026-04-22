"use strict";

const fs = require("fs");
const path = require("path");

function getRuntimeRoots() {
  return [
    path.join(__dirname, "packages", "runtime"),
    path.join(__dirname, "..", "..", "packages", "runtime"),
  ];
}

function resolveSharedRuntimePath(...segments) {
  for (const runtimeRoot of getRuntimeRoots()) {
    const candidatePath = path.join(runtimeRoot, ...segments);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return path.join(getRuntimeRoots()[0], ...segments);
}

module.exports = {
  getRuntimeRoots,
  resolveSharedRuntimePath,
};
