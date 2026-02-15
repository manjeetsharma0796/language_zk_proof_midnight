import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const contractRoot = path.resolve(root, '..', 'voting-contract');

const dirs = [
  {
    from: path.join(contractRoot, 'src', 'managed', 'language', 'zkir'),
    to: path.join(root, 'public', 'midnight', 'language', 'zkir'),
  },
];
const files = [
  {
    from: path.join(contractRoot, 'deployment.json'),
    to: path.join(root, 'public', 'deployment.json'),
  },
];

for (const { from, to } of dirs) {
  if (!fs.existsSync(from)) {
    console.warn('Skip (missing):', from);
    continue;
  }
  fs.mkdirSync(to, { recursive: true });
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(from, e.name);
    const t = path.join(to, e.name);
    if (e.isDirectory()) {
      fs.cpSync(s, t, { recursive: true });
    } else {
      fs.copyFileSync(s, t);
    }
  }
  console.log('Copied dir:', from, '->', to);
}

for (const { from, to } of files) {
  if (!fs.existsSync(from)) {
    console.warn('Skip (missing):', from);
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log('Copied file:', from, '->', to);
}
