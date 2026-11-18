/*
 * Build explicit source archives outside all public/static roots.
 * Only listed source folders are included; private data, hidden files, symlinks and existing ZIPs are excluded.
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

/* Create full and reduced source archives with deterministic Windows-compatible ZIP metadata. */
async function buildWindowsZip() {
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, 'public');
  const outputDir = path.join(rootDir, 'artifacts', 'source');
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const rootFiles = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'server.ts',
    'index.html',
    'README.md',
    '.env.example',
    '.gitignore',
    'metadata.json',
    '.nvmrc',
    'render.yaml',
    'AREVA_TECHNICAL_DOCUMENTATION.md',
  ];

  /* Copy only ordinary permitted source entries, skipping hidden files and symlinks at every directory level. */
  function addFolderRecursively(zipInstance, dirPath, zipFolderPrefix, excludeExt = []) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.lstatSync(fullPath);
      if (stat.isSymbolicLink() || item.startsWith('.')) continue;

      if (stat.isDirectory()) {
        const nextZipPrefix = zipFolderPrefix ? `${zipFolderPrefix}/${item}` : item;
        addFolderRecursively(zipInstance, fullPath, nextZipPrefix, excludeExt);
      } else {
        if (/\.zip$/i.test(item) || excludeExt.some(ext => item.endsWith(ext))) {
          continue;
        }
        const zipEntryPath = zipFolderPrefix ? `${zipFolderPrefix}/${item}` : item;
        const fileData = fs.readFileSync(fullPath);
        zipInstance.file(zipEntryPath, fileData, {
          date: new Date('2026-01-01T00:00:00Z'),
          createFolders: true,
        });
      }
    }
  }

  /* Assemble the explicit source allowlist and write the archive with private filesystem permissions. */
  async function generateArchive(outputPath, isLightweight = false) {
    const zip = new JSZip();

    // Add root files
    for (const file of rootFiles) {
      const fullPath = path.join(rootDir, file);
      if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath);
        zip.file(file, content, {
          date: new Date('2026-01-01T00:00:00Z'),
        });
      }
    }

    // Add src
    const srcDir = path.join(rootDir, 'src');
    if (fs.existsSync(srcDir) && fs.lstatSync(srcDir).isDirectory()) {
      addFolderRecursively(zip, srcDir, 'src', isLightweight ? ['.jpg', '.png'] : []);
    }

    /* Keep setup instructions, SQL and referenced npm scripts in exported source. */
    for (const folder of ['scripts', 'tests', 'docs', 'database']) {
      const directory = path.join(rootDir, folder);
      if (fs.existsSync(directory) && fs.lstatSync(directory).isDirectory()) {
        addFolderRecursively(zip, directory, folder);
      }
    }

    // Server PDF generation needs the licensed fonts in source packages too.
    const serverAssets = path.join(rootDir, 'assets');
    if (fs.existsSync(serverAssets) && fs.lstatSync(serverAssets).isDirectory()) addFolderRecursively(zip, serverAssets, 'assets');

    // Add public (excluding any zip files)
    if (fs.existsSync(publicDir) && fs.lstatSync(publicDir).isDirectory()) {
      addFolderRecursively(zip, publicDir, 'public', ['.zip']);
    }

    // Generate with explicit DOS platform for 100% Windows Explorer compatibility
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
      platform: 'DOS',
    });

    fs.writeFileSync(outputPath, buffer, { mode: 0o600 });
    console.log(`Generated ${outputPath} (${buffer.length} bytes)`);
  }

  await generateArchive(path.join(outputDir, 'areva-paints-fullstack.zip'), false);
  await generateArchive(path.join(outputDir, 'areva-paints-code.zip'), true);
  console.log('All archives built successfully with MS-DOS compatibility!');
}

buildWindowsZip().catch(error => { console.error(error); process.exitCode = 1; });
