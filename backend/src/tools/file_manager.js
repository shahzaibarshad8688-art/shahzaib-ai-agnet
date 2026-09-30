import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_DIR = path.resolve(__dirname, '../../../data/workspace');

/**
 * Ensures workspace directory exists and resolves safe absolute paths within it
 */
async function resolveWorkspacePath(relativePath) {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  const sanitized = path.normalize(relativePath || '').replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.resolve(WORKSPACE_DIR, sanitized);
  
  if (!fullPath.startsWith(WORKSPACE_DIR)) {
    throw new Error('Access denied: Cannot access files outside the workspace directory.');
  }
  return fullPath;
}

export const fileManagerTool = {
  name: 'file_manager',
  label: 'Workspace File System',
  description: 'Read, write, list, inspect, and manage files in the agent workspace. Write and delete operations require authorization checkpoint.',
  category: 'filesystem',
  requiresConfirmation: true, // Conditionally evaluated based on action (write/delete = true, read/list = false)
  dangerLevel: 'medium',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'write', 'list', 'search', 'delete', 'stat'],
        description: 'File operation to perform'
      },
      filepath: {
        type: 'string',
        description: 'Relative path of the target file or directory within workspace'
      },
      content: {
        type: 'string',
        description: 'File content (required for "write" action)'
      },
      searchQuery: {
        type: 'string',
        description: 'Search string or keyword to find within workspace files (for "search" action)'
      }
    },
    required: ['action']
  },

  /**
   * Dynamic checkpoint check: reads and lists are safe, writes and deletes require checkpoint
   */
  checkRequiresConfirmation(args) {
    const action = args?.action;
    if (action === 'write' || action === 'delete') {
      return {
        required: true,
        dangerLevel: action === 'delete' ? 'high' : 'medium',
        reason: `Agent is requesting to ${action.toUpperCase()} file: "${args.filepath || 'unspecified'}"`
      };
    }
    return { required: false, dangerLevel: 'safe' };
  },

  async execute({ action, filepath = '', content = '', searchQuery = '' }) {
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });

    switch (action) {
      case 'read': {
        if (!filepath) throw new Error('Parameter "filepath" is required for read operation.');
        const targetPath = await resolveWorkspacePath(filepath);
        const data = await fs.readFile(targetPath, 'utf-8');
        return {
          status: 'success',
          action: 'read',
          filepath,
          bytes: Buffer.byteLength(data, 'utf8'),
          content: data
        };
      }

      case 'write': {
        if (!filepath) throw new Error('Parameter "filepath" is required for write operation.');
        const targetPath = await resolveWorkspacePath(filepath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, content || '', 'utf-8');
        return {
          status: 'success',
          action: 'write',
          filepath,
          bytesWritten: Buffer.byteLength(content || '', 'utf8'),
          message: `Successfully wrote file: ${filepath}`
        };
      }

      case 'delete': {
        if (!filepath) throw new Error('Parameter "filepath" is required for delete operation.');
        const targetPath = await resolveWorkspacePath(filepath);
        await fs.unlink(targetPath);
        return {
          status: 'success',
          action: 'delete',
          filepath,
          message: `Successfully deleted file: ${filepath}`
        };
      }

      case 'list': {
        const targetDir = await resolveWorkspacePath(filepath);
        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        const list = await Promise.all(
          entries.map(async entry => {
            const full = path.join(targetDir, entry.name);
            const rel = path.relative(WORKSPACE_DIR, full);
            const stat = await fs.stat(full).catch(() => null);
            return {
              name: entry.name,
              relativePath: rel,
              isDirectory: entry.isDirectory(),
              size: stat ? stat.size : 0,
              modified: stat ? stat.mtime : null
            };
          })
        );
        return {
          status: 'success',
          action: 'list',
          directory: filepath || '.',
          totalFiles: list.length,
          files: list
        };
      }

      case 'search': {
        if (!searchQuery) throw new Error('Parameter "searchQuery" is required for search operation.');
        const matches = [];

        async function scanDir(dir) {
          const items = await fs.readdir(dir, { withFileTypes: true });
          for (const item of items) {
            const full = path.join(dir, item.name);
            if (item.isDirectory()) {
              await scanDir(full);
            } else if (item.isFile()) {
              try {
                const text = await fs.readFile(full, 'utf-8');
                if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
                  const rel = path.relative(WORKSPACE_DIR, full);
                  matches.push({
                    file: rel,
                    matchedLines: text
                      .split('\n')
                      .filter(l => l.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, 3)
                  });
                }
              } catch {
                // Ignore binary/unreadable files
              }
            }
          }
        }

        await scanDir(WORKSPACE_DIR);
        return {
          status: 'success',
          action: 'search',
          query: searchQuery,
          matchesCount: matches.length,
          matches
        };
      }

      case 'stat': {
        const targetPath = await resolveWorkspacePath(filepath);
        const stat = await fs.stat(targetPath);
        return {
          status: 'success',
          action: 'stat',
          filepath,
          size: stat.size,
          created: stat.birthtime,
          modified: stat.mtime,
          isFile: stat.isFile(),
          isDirectory: stat.isDirectory()
        };
      }

      default:
        throw new Error(`Unknown file action: ${action}`);
    }
  }
};

export default fileManagerTool;
