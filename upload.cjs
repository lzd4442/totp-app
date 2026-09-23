const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'lzd4442/totp-app';

function gh(cmd) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

function uploadFile(filePath, content) {
  // Check if file exists to get SHA
  let sha = null;
  try {
    const r = gh(`gh api /repos/${REPO}/contents/${encodeURIComponent(filePath)} --jq .sha 2>/dev/null`);
    sha = r.trim() || null;
  } catch {}

  const encoded = Buffer.from(content).toString('base64');
  const args = [`-f message='add ${filePath}'`, `-f content='${encoded}'`];
  if (sha) args.push(`-f sha='${sha}'`);
  execSync(`gh api -X PUT /repos/${REPO}/contents/${encodeURIComponent(filePath)} ${args.join(' ')}`, { encoding: 'utf8' });
  console.log('OK:', filePath);
}

function walk(dir, base) {
  const files = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const rel = path.posix.join(base, entry.name);
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...walk(full, rel));
      } else {
        files.push({ path: rel, content: fs.readFileSync(full) });
      }
    }
  } catch (e) {
    console.error('Error walking', dir, e.message);
  }
  return files;
}

const files = walk('.', '');
console.log(`Found ${files.length} files to upload`);

for (const f of files) {
  try {
    uploadFile(f.path, f.content);
  } catch (e) {
    console.error('FAIL:', f.path, e.message.split('\n')[0]);
  }
}

console.log('All done!');
