/**
 * Computer Use API — 环境检测与依赖安装
 *
 * Routes:
 *   GET  /api/computer-use/status  — 检测 Python3、venv、依赖、权限状态
 *   POST /api/computer-use/setup   — 创建 venv 并安装依赖
 */

import { homedir } from 'os'
import { join } from 'path'
import { access, readFile, mkdir, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
// Embed helper scripts at compile time so they're available in bundled mode
// @ts-ignore — Bun text import
import MAC_HELPER_CONTENT from '../../../runtime/mac_helper.py' with { type: 'text' }
// @ts-ignore — Bun text import
import WIN_HELPER_CONTENT from '../../../runtime/win_helper.py' with { type: 'text' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../..')
const devRuntimeRoot = join(projectRoot, 'runtime')
const claudeHome = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
const runtimeStateRoot = join(claudeHome, '.runtime')
const venvRoot = join(runtimeStateRoot, 'venv')
const installStampPath = join(runtimeStateRoot, 'requirements.sha256')

// Embedded content of requirements — platform-specific.
const REQUIREMENTS_DARWIN = `mss>=10.1.0
Pillow>=11.3.0
pyautogui>=0.9.54
pyobjc-core>=11.1
pyobjc-framework-Cocoa>=11.1
pyobjc-framework-Quartz>=11.1
`

const REQUIREMENTS_WIN32 = `mss>=10.1.0
Pillow>=11.3.0
pyautogui>=0.9.54
pywin32>=306
psutil>=5.9.0
pyperclip>=1.8.2
screeninfo>=0.8.1
`

const isWindows = process.platform === 'win32'
const REQUIREMENTS_CONTENT = isWindows ? REQUIREMENTS_WIN32 : REQUIREMENTS_DARWIN

// 清华大学 PyPI 镜像，国内安装速度更快
const PIP_INDEX_URL = 'https://pypi.tuna.tsinghua.edu.cn/simple/'
const PIP_TRUSTED_HOST = 'pypi.tuna.tsinghua.edu.cn'

// Paths that resolve correctly in both dev and bundled modes
function getRequirementsPath(): string {
  return join(runtimeStateRoot, 'requirements.txt')
}

function getHelperFileName(): string {
  return isWindows ? 'win_helper.py' : 'mac_helper.py'
}

function getHelperPath(): string {
  return join(runtimeStateRoot, getHelperFileName())
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function runCommand(
  cmd: string,
  args: string[],
): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
  try {
    const proc = Bun.spawn([cmd, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    const code = await proc.exited
    return { ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), code }
  } catch {
    return { ok: false, stdout: '', stderr: `Failed to run ${cmd}`, code: -1 }
  }
}

/**
 * Ensure runtime source files (requirements.txt, mac_helper.py) exist in
 * ~/.claude/.runtime/. In dev mode they are copied from the project's
 * runtime/ directory; in bundled mode requirements.txt is written from the
 * embedded constant and mac_helper.py is copied from the project dir (if
 * available) or skipped (it will already have been extracted on a prior run).
 */
async function ensureRuntimeFiles(): Promise<void> {
  await mkdir(runtimeStateRoot, { recursive: true })

  // requirements.txt — always write from embedded constant (authoritative)
  await writeFile(getRequirementsPath(), REQUIREMENTS_CONTENT, 'utf8')

  // helper script — write the platform-appropriate version
  const helperContent = isWindows ? WIN_HELPER_CONTENT : MAC_HELPER_CONTENT
  await writeFile(getHelperPath(), helperContent, 'utf8')
}

type EnvStatus = {
  platform: string
  supported: boolean
  python: {
    installed: boolean
    version: string | null
    path: string | null
  }
  venv: {
    created: boolean
    path: string
  }
  dependencies: {
    installed: boolean
    requirementsFound: boolean
  }
  permissions: {
    accessibility: boolean | null
    screenRecording: boolean | null
  }
}

async function checkStatus(): Promise<EnvStatus> {
  const platform = process.platform
  const supported = platform === 'darwin' || platform === 'win32'

  // Check Python 3 — Windows may only have `python`, not `python3`
  const pythonCmd = isWindows ? 'python' : 'python3'
  const pythonResult = await runCommand(pythonCmd, ['--version'])
  const pythonInstalled = pythonResult.ok
  const pythonVersion = pythonInstalled
    ? pythonResult.stdout.replace('Python ', '')
    : null

  let pythonPath: string | null = null
  if (pythonInstalled) {
    const whichCmd = isWindows ? 'where' : 'which'
    const whichResult = await runCommand(whichCmd, [pythonCmd])
    pythonPath = whichResult.ok ? whichResult.stdout.split('\n')[0] : null
  }

  // Check venv — different paths on Windows vs Unix
  const venvPython = isWindows
    ? join(venvRoot, 'Scripts', 'python.exe')
    : join(venvRoot, 'bin', 'python3')
  const venvCreated = await pathExists(venvPython)

  // Check dependencies — use the state dir copy
  const reqPath = getRequirementsPath()
  const requirementsFound = await pathExists(reqPath)
  let depsInstalled = false
  if (requirementsFound && venvCreated) {
    try {
      const requirements = await readFile(reqPath, 'utf8')
      const digest = createHash('sha256').update(requirements).digest('hex')
      const stamp = (await readFile(installStampPath, 'utf8')).trim()
      depsInstalled = stamp === digest
    } catch {
      depsInstalled = false
    }
  }

  // Check macOS permissions without triggering a system prompt. The helper
  // uses preflight + visible-window metadata as a passive fallback because
  // plain preflight can misreport child processes launched by the desktop app.
  let accessibility: boolean | null = null
  let screenRecording: boolean | null = null
  if (supported && venvCreated && depsInstalled) {
    try { await ensureRuntimeFiles() } catch {}
    const helperPath = getHelperPath()
    if (await pathExists(helperPath)) {
      const permResult = await runCommand(venvPython, [helperPath, 'check_permissions'])
      if (permResult.ok) {
        try {
          const parsed = JSON.parse(permResult.stdout)
          if (parsed.ok && parsed.result) {
            accessibility = parsed.result.accessibility ?? null
            screenRecording = parsed.result.screenRecording ?? null
          }
        } catch {}
      }
    }
  }

  return {
    platform,
    supported,
    python: { installed: pythonInstalled, version: pythonVersion, path: pythonPath },
    venv: { created: venvCreated, path: venvRoot },
    dependencies: { installed: depsInstalled, requirementsFound: requirementsFound || true },
    permissions: { accessibility, screenRecording },
  }
}

type SetupResult = {
  success: boolean
  steps: { name: string; ok: boolean; message: string }[]
}

async function runSetup(): Promise<SetupResult> {
  const steps: SetupResult['steps'] = []

  // Step 1: Check python
  const pythonCmd = isWindows ? 'python' : 'python3'
  const pythonCheck = await runCommand(pythonCmd, ['--version'])
  if (!pythonCheck.ok) {
    steps.push({
      name: 'python_check',
      ok: false,
      message: 'Python 3 未安装，请先安装 Python 3',
    })
    return { success: false, steps }
  }
  steps.push({
    name: 'python_check',
    ok: true,
    message: `Python ${pythonCheck.stdout.replace('Python ', '')}`,
  })

  // Step 2: Extract runtime files to ~/.claude/.runtime/
  try {
    await ensureRuntimeFiles()
    steps.push({ name: 'runtime_files', ok: true, message: '运行时文件已就绪' })
  } catch (err) {
    steps.push({
      name: 'runtime_files',
      ok: false,
      message: `提取运行时文件失败: ${err}`,
    })
    return { success: false, steps }
  }

  // Step 3: Create venv
  const venvPython = isWindows
    ? join(venvRoot, 'Scripts', 'python.exe')
    : join(venvRoot, 'bin', 'python3')
  const venvExists = await pathExists(venvPython)
  if (!venvExists) {
    const venvResult = await runCommand(pythonCmd, ['-m', 'venv', venvRoot])
    if (!venvResult.ok) {
      steps.push({
        name: 'venv',
        ok: false,
        message: `创建虚拟环境失败: ${venvResult.stderr}`,
      })
      return { success: false, steps }
    }
    steps.push({ name: 'venv', ok: true, message: '虚拟环境已创建' })
  } else {
    steps.push({ name: 'venv', ok: true, message: '虚拟环境已存在' })
  }

  // Step 4: Ensure pip
  const pipPath = isWindows
    ? join(venvRoot, 'Scripts', 'pip.exe')
    : join(venvRoot, 'bin', 'pip')
  if (!(await pathExists(pipPath))) {
    const pipResult = await runCommand(venvPython, [
      '-m',
      'ensurepip',
      '--upgrade',
    ])
    if (!pipResult.ok) {
      steps.push({
        name: 'pip',
        ok: false,
        message: `安装 pip 失败: ${pipResult.stderr}`,
      })
      return { success: false, steps }
    }
  }
  steps.push({ name: 'pip', ok: true, message: 'pip 已就绪' })

  // Step 5: Install requirements
  const reqPath = getRequirementsPath()
  const requirements = await readFile(reqPath, 'utf8')
  const digest = createHash('sha256').update(requirements).digest('hex')

  let installedDigest = ''
  try {
    installedDigest = (await readFile(installStampPath, 'utf8')).trim()
  } catch {}

  if (installedDigest !== digest) {
    // Upgrade pip first (using China mirror)
    await runCommand(venvPython, [
      '-m', 'pip', 'install', '--upgrade', 'pip',
      '-i', PIP_INDEX_URL, '--trusted-host', PIP_TRUSTED_HOST,
    ])

    // Install deps (using China mirror)
    const installResult = await runCommand(venvPython, [
      '-m', 'pip', 'install',
      '-r', reqPath,
      '-i', PIP_INDEX_URL, '--trusted-host', PIP_TRUSTED_HOST,
    ])
    if (!installResult.ok) {
      steps.push({
        name: 'deps',
        ok: false,
        message: `安装依赖失败: ${installResult.stderr.slice(0, 500)}`,
      })
      return { success: false, steps }
    }
    await writeFile(installStampPath, `${digest}\n`, 'utf8')
    steps.push({ name: 'deps', ok: true, message: '依赖已安装' })
  } else {
    steps.push({ name: 'deps', ok: true, message: '依赖已是最新' })
  }

  return { success: true, steps }
}

// ============================================================================
// Authorized Apps configuration — stored in ~/.claude/cc-haha/computer-use-config.json
// ============================================================================

const configPath = join(claudeHome, 'cc-haha', 'computer-use-config.json')

type AuthorizedApp = {
  bundleId: string
  displayName: string
  authorizedAt: string
}

type ComputerUseConfig = {
  authorizedApps: AuthorizedApp[]
  grantFlags: {
    clipboardRead: boolean
    clipboardWrite: boolean
    systemKeyCombos: boolean
  }
}

const DEFAULT_CONFIG: ComputerUseConfig = {
  authorizedApps: [],
  grantFlags: { clipboardRead: true, clipboardWrite: true, systemKeyCombos: true },
}

async function loadConfig(): Promise<ComputerUseConfig> {
  try {
    const raw = await readFile(configPath, 'utf8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

async function saveConfig(config: ComputerUseConfig): Promise<void> {
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
}

async function listInstalledApps(): Promise<{ bundleId: string; displayName: string; path: string }[]> {
  const helperPath = getHelperPath()
  const pythonBin = isWindows
    ? join(venvRoot, 'Scripts', 'python.exe')
    : join(venvRoot, 'bin', 'python3')

  if (!(await pathExists(pythonBin)) || !(await pathExists(helperPath))) {
    return []
  }

  const result = await runCommand(pythonBin, [helperPath, 'list_installed_apps'])
  if (!result.ok) return []

  try {
    const parsed = JSON.parse(result.stdout)
    return parsed.ok ? parsed.result : []
  } catch {
    return []
  }
}

// ============================================================================
// Route handler
// ============================================================================

export async function handleComputerUseApi(
  req: Request,
  _url: URL,
  segments: string[],
): Promise<Response> {
  const action = segments[2]

  if (action === 'status' && req.method === 'GET') {
    const status = await checkStatus()
    return Response.json(status)
  }

  if (action === 'setup' && req.method === 'POST') {
    const result = await runSetup()
    return Response.json(result)
  }

  // GET /api/computer-use/apps — list installed macOS apps
  if (action === 'apps' && req.method === 'GET') {
    const apps = await listInstalledApps()
    return Response.json({ apps })
  }

  // GET /api/computer-use/authorized-apps — current authorized app config
  if (action === 'authorized-apps' && req.method === 'GET') {
    const config = await loadConfig()
    return Response.json(config)
  }

  // PUT /api/computer-use/authorized-apps — update authorized apps
  if (action === 'authorized-apps' && req.method === 'PUT') {
    try {
      const body = (await req.json()) as Partial<ComputerUseConfig>
      const config = await loadConfig()
      if (body.authorizedApps) config.authorizedApps = body.authorizedApps
      if (body.grantFlags) config.grantFlags = { ...config.grantFlags, ...body.grantFlags }
      await saveConfig(config)
      return Response.json({ ok: true })
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  // POST /api/computer-use/open-settings — open system settings pane
  if (action === 'open-settings' && req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as { pane?: string }
    const pane = body.pane ?? 'Privacy_ScreenCapture'
    const allowed = ['Privacy_ScreenCapture', 'Privacy_Accessibility']
    if (!allowed.includes(pane)) {
      return Response.json({ error: 'Invalid pane' }, { status: 400 })
    }

    if (process.platform === 'darwin') {
      const url = `x-apple.systempreferences:com.apple.preference.security?${pane}`
      await runCommand('open', [url])
    } else if (process.platform === 'win32') {
      // Windows doesn't need privacy settings like macOS TCC, but we can
      // open the general privacy page if requested
      await runCommand('cmd', ['/c', 'start', 'ms-settings:privacy'])
    } else {
      return Response.json({ error: 'Unsupported platform' }, { status: 400 })
    }
    return Response.json({ ok: true })
  }

  return Response.json(
    { error: 'NOT_FOUND', message: `Unknown computer-use action: ${action}` },
    { status: 404 },
  )
}
