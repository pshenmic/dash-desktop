const {execFile} = require('node:child_process')
const {copyFile, mkdtemp, readdir, rm} = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const {promisify} = require('node:util')

const run = promisify(execFile)

const REQUIRED_ENV = ['CODE_SIGN_TOOL_PATH', 'ESIGNER_USERNAME', 'ESIGNER_PASSWORD', 'ESIGNER_TOTP_SECRET']

// electron-builder `win.signtoolOptions.sign` hook: signs through SSL.com
// eSigner with CodeSignTool, which the release workflow installs.
module.exports = async function esignerSign(configuration) {
  // CodeSignTool picks the digest itself, so a sha1 pass would only spend a
  // second eSigner signing on the same file.
  if (configuration.hash !== 'sha256') return

  // The Store signs the package with the Partner Center publisher identity.
  if (configuration.path.endsWith('.appx')) return

  const missing = REQUIRED_ENV.filter(name => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`eSigner signing is configured but ${missing.join(', ')} is not set`)
  }

  const toolDir = process.env.CODE_SIGN_TOOL_PATH
  const jar = (await readdir(path.join(toolDir, 'jar'))).find(name => /^code_sign_tool-.*\.jar$/.test(name))
  // The Windows archive bundles a JRE; the Linux/macOS one expects java on PATH.
  const jdk = (await readdir(toolDir)).find(name => name.startsWith('jdk-'))
  const java = jdk == null ? 'java' : path.join(toolDir, jdk, 'bin', 'java')

  const outDir = await mkdtemp(path.join(os.tmpdir(), 'esigner-'))
  try {
    const args = [
      '-jar', path.join(toolDir, 'jar', jar), 'sign',
      `-username=${process.env.ESIGNER_USERNAME}`,
      `-password=${process.env.ESIGNER_PASSWORD}`,
      `-totp_secret=${process.env.ESIGNER_TOTP_SECRET}`,
      `-input_file_path=${configuration.path}`,
      `-output_dir_path=${outDir}`,
    ]
    if (process.env.ESIGNER_CREDENTIAL_ID) {
      args.push(`-credential_id=${process.env.ESIGNER_CREDENTIAL_ID}`)
    }

    // CodeSignTool reads conf/ relative to its own directory and exits 0 on
    // every failure, so only its success line proves the file was signed.
    const {stdout, stderr} = await run(java, args, {cwd: toolDir, timeout: 5 * 60 * 1000})
    if (!stdout.includes('Code signed successfully')) {
      throw new Error(`eSigner failed to sign ${configuration.path}: ${`${stdout}\n${stderr}`.trim()}`)
    }

    await copyFile(path.join(outDir, path.basename(configuration.path)), configuration.path)
  } finally {
    await rm(outDir, {recursive: true, force: true})
  }
}
