const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

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
    'tsconfig.json',
    'vite.config.ts',
    'server.ts',
    'index.html',
    'README.md',
    '.env.example',
    '.gitignore',
    'metadata.json',
  ];

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
        if (excludeExt.some(ext => item.endsWith(ext))) {
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

  async function generateArchive(outputPath, isLightweight = false) {
    const zip = new JSZip();

    // Add root files
    for (const file of rootFiles) {
      const fullPath = path.join(rootDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        zip.file(file, content, {
          date: new Date('2026-01-01T00:00:00Z'),
        });
      }
    }

    // Add src
    const srcDir = path.join(rootDir, 'src');
    if (fs.existsSync(srcDir)) {
      addFolderRecursively(zip, srcDir, 'src', isLightweight ? ['.jpg', '.png'] : []);
    }

    // Add public (excluding any zip files)
    if (fs.existsSync(publicDir)) {
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
