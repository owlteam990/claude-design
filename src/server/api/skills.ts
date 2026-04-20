/**
 * Skills REST API
 *
 * GET /api/skills              — List all installed skills (metadata only)
 * GET /api/skills/detail       — Full skill data (tree + files)
 *       ?source=user&name=xxx
 */

import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs/promises'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'

// ─── Types ───────────────────────────────────────────────────────────────────

type SkillMeta = {
  name: string
  displayName?: string
  description: string
  source: 'user' | 'project'
  userInvocable: boolean
  version?: string
  contentLength: number
  hasDirectory: boolean
}

type FileTreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

type SkillFile = {
  path: string
  content: string
  language: string
  frontmatter?: Record<string, unknown>
  body?: string
  isEntry?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILES = 50
const MAX_FILE_SIZE = 100 * 1024 // 100 KB
const SKIP_ENTRIES = new Set(['node_modules', '.git', '__pycache__', '.DS_Store'])

const LANG_MAP: Record<string, string> = {
  md: 'markdown', ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', json: 'json',
  yaml: 'yaml', yml: 'yaml', sh: 'bash', bash: 'bash',
  py: 'python', toml: 'toml', css: 'css', html: 'html',
  txt: 'text', xml: 'xml', sql: 'sql', rs: 'rust', go: 'go',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return LANG_MAP[ext] || 'text'
}

function normalizeFrontmatter(content: string, sourcePath?: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const parsed = parseFrontmatter(content, sourcePath)
  return {
    frontmatter: parsed.frontmatter as Record<string, unknown>,
    body: parsed.content,
  }
}

function getUserSkillsDir(): string {
  return path.join(os.homedir(), '.claude', 'skills')
}

async function loadSkillMeta(
  skillDir: string,
  skillName: string,
  source: 'user' | 'project',
): Promise<SkillMeta | null> {
  const skillFile = path.join(skillDir, 'SKILL.md')
  try {
    const raw = await fs.readFile(skillFile, 'utf-8')
    const { frontmatter, body } = normalizeFrontmatter(raw, skillFile)

    const description =
      (frontmatter.description as string) ||
      body
        .split('\n')
        .find((l) => l.trim().length > 0)
        ?.trim() ||
      'No description'

    return {
      name: skillName,
      displayName: (frontmatter.name as string) || undefined,
      description,
      source,
      userInvocable: frontmatter['user-invocable'] !== false,
      version: frontmatter.version != null ? String(frontmatter.version) : undefined,
      contentLength: raw.length,
      hasDirectory: true,
    }
  } catch {
    return null
  }
}

async function buildFileTree(
  dirPath: string,
): Promise<{ tree: FileTreeNode[]; files: SkillFile[] }> {
  const tree: FileTreeNode[] = []
  const files: SkillFile[] = []
  let fileCount = 0

  async function walk(currentPath: string, nodes: FileTreeNode[]) {
    if (fileCount >= MAX_FILES) return

    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    // directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      if (fileCount >= MAX_FILES) break
      if (SKIP_ENTRIES.has(entry.name) || entry.name.startsWith('.')) continue

      const fullPath = path.join(currentPath, entry.name)
      const relPath = path.relative(dirPath, fullPath)

      if (entry.isDirectory()) {
        const node: FileTreeNode = {
          name: entry.name,
          path: relPath,
          type: 'directory',
          children: [],
        }
        nodes.push(node)
        await walk(fullPath, node.children!)
        if (node.children!.length === 0) delete node.children
      } else if (entry.isFile()) {
        nodes.push({ name: entry.name, path: relPath, type: 'file' })

        try {
          const stat = await fs.stat(fullPath)
          if (stat.size <= MAX_FILE_SIZE) {
            const content = await fs.readFile(fullPath, 'utf-8')
            const language = detectLanguage(entry.name)
            const isEntry = relPath === 'SKILL.md'

            if (isEntry && language === 'markdown') {
              const { frontmatter, body } = normalizeFrontmatter(content, fullPath)
              files.push({
                path: relPath,
                content: body,
                body,
                frontmatter,
                language,
                isEntry: true,
              })
            } else {
              files.push({
                path: relPath,
                content,
                language,
                isEntry: false,
              })
            }
            fileCount++
          }
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await walk(dirPath, tree)
  return { tree, files }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export async function handleSkillsApi(
  req: Request,
  url: URL,
  segments: string[],
): Promise<Response> {
  try {
    if (req.method !== 'GET') {
      throw new ApiError(405, `Method ${req.method} not allowed`, 'METHOD_NOT_ALLOWED')
    }

    const sub = segments[2]

    switch (sub) {
      case undefined:
        return await listSkills()
      case 'detail':
        return await getSkillDetail(url)
      default:
        throw ApiError.notFound(`Unknown skills endpoint: ${sub}`)
    }
  } catch (error) {
    return errorResponse(error)
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function listSkills(): Promise<Response> {
  const skillsDir = getUserSkillsDir()
  const skills: SkillMeta[] = []

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const meta = await loadSkillMeta(
        path.join(skillsDir, entry.name),
        entry.name,
        'user',
      )
      if (meta) skills.push(meta)
    }
  } catch {
    // skills dir doesn't exist — return empty list
  }

  skills.sort((a, b) => a.name.localeCompare(b.name))
  return Response.json({ skills })
}

async function getSkillDetail(url: URL): Promise<Response> {
  const source = url.searchParams.get('source')
  const name = url.searchParams.get('name')

  if (!source || !name) {
    throw ApiError.badRequest('Missing required query parameters: source, name')
  }

  // Prevent path traversal
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw ApiError.badRequest('Invalid skill name')
  }

  let skillDir: string
  if (source === 'user') {
    skillDir = path.join(getUserSkillsDir(), name)
  } else {
    throw ApiError.badRequest(`Unsupported source: ${source}`)
  }

  try {
    const stat = await fs.stat(skillDir)
    if (!stat.isDirectory()) throw new Error()
  } catch {
    throw ApiError.notFound(`Skill not found: ${name}`)
  }

  const meta = await loadSkillMeta(skillDir, name, source as 'user')
  if (!meta) {
    throw ApiError.notFound(`Skill missing SKILL.md: ${name}`)
  }

  const { tree, files } = await buildFileTree(skillDir)

  return Response.json({
    detail: { meta, tree, files, skillRoot: skillDir },
  })
}
