const {readdir, rm} = require('node:fs/promises')
const path = require('node:path')
const {Arch} = require('builder-util')

// pshenmic-dpp and crypto-toothpick ship a build for every target and pick one
// at runtime, so electron-builder cannot tell which are dead weight. Only a
// pack knows both the platform and the architecture it is producing.
module.exports = async function pruneForeignBinaries(context) {
  const arch = Arch[context.arch]

  // A universal build packs each arch into `<appOutDir>-<arch>-temp` and merges
  // them with asar.extractAll, which still resolves every unpacked entry the
  // header lists — so a file deleted here would fail the merge.
  if (context.appOutDir.endsWith(`-${arch}-temp`)) return

  const suffixes = {
    darwin: ['apple-darwin'],
    mas: ['apple-darwin'],
    win32: ['pc-windows-msvc'],
    linux: ['unknown-linux-gnu', 'unknown-linux-musl'],
  }[context.electronPlatformName]

  // ia32, armv7l and the merged universal app have no single target to keep:
  // the first two have no build at all and fall back to the wasm.
  const prefix = {x64: 'x86_64', arm64: 'aarch64'}[arch]
  if (suffixes == null || prefix == null) return

  const keep = new Set(suffixes.map(suffix => `${prefix}-${suffix}`))
  const modules = path.join(context.packager.getResourcesDir(context.appOutDir), 'app.asar.unpacked', 'node_modules')

  for (const pkg of ['pshenmic-dpp', 'crypto-toothpick']) {
    const dir = path.join(modules, pkg, 'dist', 'binaries', 'native')

    // A missing directory means the package layout or the asar unpacking moved;
    // failing the build beats silently shipping every target again.
    for (const target of await readdir(dir)) {
      if (!keep.has(target)) await rm(path.join(dir, target), {recursive: true, force: true})
    }
  }
}
