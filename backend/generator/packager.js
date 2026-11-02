'use strict';

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

function createZip({ outputDir, workDir, projectName }) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(workDir, `${projectName}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    archive.on('error', (error) => {
      try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
      reject(error);
    });

    archive.pipe(output);
    archive.directory(outputDir, false);
    archive.finalize();
  });
}

module.exports = { createZip };
