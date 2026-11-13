const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let commitId = 'dev';
try {
  commitId = execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim();
} catch (e) {
  commitId = 'dev';
}

const targetPath = path.join(__dirname, '..', 'lib', 'version.json');
fs.writeFileSync(targetPath, JSON.stringify({ commit: commitId }, null, 2) + '\n');
console.log(`[build-info] Auto-generated commit ID: ${commitId}`);

