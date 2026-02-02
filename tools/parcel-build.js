/* tslint:disable */

const { Parcel } = require('@parcel/core')
const path = require('path')
const fs = require('fs')

async function copyLib() {
  const target = path.join(__dirname, '../dist/static')
  const lib = path.join(__dirname, '../src/renderer/lib')
  const index = path.join(target, 'index.html')

  // Copy in lib
  await fs.promises.cp(lib, target, { recursive: true });

  // Patch so that fs.read is used
  const libv86path = path.join(target, 'libv86.js')
  const libv86 = fs.readFileSync(libv86path, 'utf-8')

  let patchedLibv86 = libv86.replace('k.load_file="undefined"===typeof XMLHttpRequest?pa:qa', 'k.load_file=pa')
  patchedLibv86 = patchedLibv86.replace('H.exportSymbol=function(a,b){"undefined"!==typeof module&&"undefined"!==typeof module.exports?module.exports[a]=b:"undefined"!==typeof window?window[a]=b:"function"===typeof importScripts&&(self[a]=b)}', 'H.exportSymbol=function(a,b){"undefined"!==typeof window?window[a]=b:"undefined"!==typeof module&&"undefined"!==typeof module.exports?module.exports[a]=b:"function"===typeof importScripts&&(self[a]=b)}')
  patchedLibv86 = patchedLibv86.replace('this.fetch=fetch;', 'this.fetch=(...args)=>fetch(...args);')

  fs.writeFileSync(libv86path, patchedLibv86)

  // Overwrite
  const indexContents = fs.readFileSync(index, 'utf-8');
  const replacedContents = indexContents.replace('<!-- libv86 -->', '<script src="libv86.js"></script>')
  fs.writeFileSync(index, replacedContents)
}

async function compileParcel (options = {}) {
  const { watch = false } = options;

  // Build the HTML entry (renderer)
  const htmlBundler = new Parcel({
    entries: path.join(__dirname, '../static/index.html'),
    defaultConfig: '@parcel/config-default',
    mode: 'production',
    defaultTargetOptions: {
      distDir: path.join(__dirname, '../dist/static'),
      publicUrl: './',
      sourceMaps: false,
    },
    additionalReporters: [
      { packageName: '@parcel/reporter-cli', resolveFrom: __filename }
    ],
    shouldDisableCache: true,
    shouldContentHash: false,
    shouldOptimize: false,
  });

  // Build the main process entry
  const mainBundler = new Parcel({
    entries: path.join(__dirname, '../src/main/main.ts'),
    defaultConfig: '@parcel/config-default',
    mode: 'production',
    defaultTargetOptions: {
      distDir: path.join(__dirname, '../dist/src/main'),
      publicUrl: '../',
      sourceMaps: false,
    },
    targets: {
      main: {
        context: 'electron-main',
        distDir: path.join(__dirname, '../dist/src/main'),
        outputFormat: 'commonjs',
      }
    },
    additionalReporters: [
      { packageName: '@parcel/reporter-cli', resolveFrom: __filename }
    ],
    shouldDisableCache: true,
    shouldContentHash: false,
    shouldOptimize: false,
  });

  if (watch) {
    const htmlSubscription = await htmlBundler.watch();
    const mainSubscription = await mainBundler.watch();
    process.on('SIGINT', async () => {
      await htmlSubscription.unsubscribe();
      await mainSubscription.unsubscribe();
      process.exit();
    });
  } else {
    await htmlBundler.run();
    await mainBundler.run();
  }

  await copyLib();
}

module.exports = {
  compileParcel
}

if (require.main === module) compileParcel()
