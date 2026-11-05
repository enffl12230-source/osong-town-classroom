// Compatibility entry point. The editable PDF source is now build-pdfs.py.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const bundled = path.join(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const python = process.env.PYTHON || (fs.existsSync(bundled) ? bundled : 'python');
const result = spawnSync(python, [path.join(__dirname, 'build-pdfs.py')], { stdio: 'inherit' });
if (result.error) { console.error(result.error.message); process.exitCode = 1; }
else process.exitCode = result.status || 0;
