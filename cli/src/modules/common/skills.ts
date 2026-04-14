import { access, readdir, readFile } from 'fs/promises';
import { basename, dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';

export interface SkillSummary {
    name: string;
    description?: string;
}

export interface ListSkillsRequest {
}

export interface ListSkillsResponse {
    success: boolean;
    skills?: SkillSummary[];
    error?: string;
}

function getHomeDirectory(): string {
    return process.env.HOME ?? process.env.USERPROFILE ?? homedir();
}

function getUserSkillsRoots(): string[] {
    const home = getHomeDirectory();
    return [
        join(home, '.agents', 'skills'),
        join(home, '.claude', 'skills'),
    ];
}

async function getInstalledPluginSkillsRoots(): Promise<string[]> {
    const home = getHomeDirectory();
    const installedPath = join(home, '.claude', 'plugins', 'installed_plugins.json');
    try {
        const content = await readFile(installedPath, 'utf-8');
        const data = JSON.parse(content);
        const plugins = data?.plugins ?? data;
        if (!plugins || typeof plugins !== 'object') return [];

        const roots: string[] = [];
        const seen = new Set<string>();
        for (const entries of Object.values(plugins)) {
            if (!Array.isArray(entries)) continue;
            for (const entry of entries) {
                const installPath = entry?.installPath;
                if (typeof installPath !== 'string') continue;
                const skillsDir = join(installPath, 'skills');
                if (!seen.has(skillsDir)) {
                    seen.add(skillsDir);
                    roots.push(skillsDir);
                }
            }
        }
        return roots;
    } catch {
        return [];
    }
}

function getAdminSkillsRoot(): string {
    return join('/etc', 'codex', 'skills');
}

function getProjectSkillsRoots(directory: string): string[] {
    return [
        join(directory, '.agents', 'skills'),
        join(directory, '.claude', 'skills'),
    ];
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function listProjectSkillsRoots(workingDirectory?: string): Promise<string[]> {
    if (!workingDirectory) {
        return [];
    }

    const resolvedWorkingDirectory = resolve(workingDirectory);
    const directories = [resolvedWorkingDirectory];
    let currentDirectory = resolvedWorkingDirectory;

    while (true) {
        if (await pathExists(join(currentDirectory, '.git'))) {
            return directories.flatMap(getProjectSkillsRoots);
        }

        const parentDirectory = dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            return getProjectSkillsRoots(resolvedWorkingDirectory);
        }

        currentDirectory = parentDirectory;
        directories.push(currentDirectory);
    }
}

function parseFrontmatter(fileContent: string): { frontmatter?: Record<string, unknown>; body: string } {
    const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        return { body: fileContent.trim() };
    }

    const yamlContent = match[1];
    const body = match[2].trim();
    try {
        const parsed = parseYaml(yamlContent) as Record<string, unknown> | null;
        return { frontmatter: parsed ?? undefined, body };
    } catch {
        return { body: fileContent.trim() };
    }
}

function extractSkillSummary(skillDir: string, fileContent: string): SkillSummary | null {
    const parsed = parseFrontmatter(fileContent);
    const nameFromFrontmatter = typeof parsed.frontmatter?.name === 'string' ? parsed.frontmatter.name.trim() : '';
    const name = nameFromFrontmatter || basename(skillDir);
    if (!name) {
        return null;
    }

    const description = typeof parsed.frontmatter?.description === 'string'
        ? parsed.frontmatter.description.trim()
        : undefined;

    return { name, description };
}

async function listTopLevelSkillDirs(skillsRoot: string): Promise<string[]> {
    try {
        const entries = await readdir(skillsRoot, { withFileTypes: true });
        const result: string[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) {
                continue;
            }

            const dirPath = join(skillsRoot, entry.name);
            // If this directory has a SKILL.md, it's a skill
            if (await pathExists(join(dirPath, 'SKILL.md'))) {
                result.push(dirPath);
            } else {
                // Otherwise check one level deeper (e.g. superpowers/brainstorming/SKILL.md)
                try {
                    const subEntries = await readdir(dirPath, { withFileTypes: true });
                    for (const sub of subEntries) {
                        if (sub.isDirectory() && !sub.name.startsWith('.')) {
                            const subPath = join(dirPath, sub.name);
                            if (await pathExists(join(subPath, 'SKILL.md'))) {
                                result.push(subPath);
                            }
                        }
                    }
                } catch {
                    // ignore unreadable subdirectories
                }
            }
        }

        return result;
    } catch {
        return [];
    }
}

async function readSkillsFromDirs(skillDirs: string[]): Promise<SkillSummary[]> {
    const skills = await Promise.all(skillDirs.map(async (dir): Promise<SkillSummary | null> => {
        const filePath = join(dir, 'SKILL.md');
        try {
            const fileContent = await readFile(filePath, 'utf-8');
            return extractSkillSummary(dir, fileContent);
        } catch {
            return null;
        }
    }));

    return skills.filter((skill): skill is SkillSummary => skill !== null);
}

export async function listSkills(workingDirectory?: string): Promise<SkillSummary[]> {
    const projectRoots = await listProjectSkillsRoots(workingDirectory);
    const pluginRoots = await getInstalledPluginSkillsRoots();
    const [projectSkillDirs, userSkillDirs, adminSkillDirs, pluginSkillDirs] = await Promise.all([
        Promise.all(projectRoots.map(async (root) => await listTopLevelSkillDirs(root))).then((dirs) => dirs.flat()),
        Promise.all(getUserSkillsRoots().map(async (root) => await listTopLevelSkillDirs(root))).then((dirs) => dirs.flat()),
        listTopLevelSkillDirs(getAdminSkillsRoot()),
        Promise.all(pluginRoots.map(async (root) => await listTopLevelSkillDirs(root))).then((dirs) => dirs.flat()),
    ]);

    const [projectSkills, userSkills, adminSkills, pluginSkills] = await Promise.all([
        readSkillsFromDirs(projectSkillDirs),
        readSkillsFromDirs(userSkillDirs),
        readSkillsFromDirs(adminSkillDirs),
        readSkillsFromDirs(pluginSkillDirs),
    ]);

    const dedupedSkills = new Map<string, SkillSummary>();
    for (const skill of [
        ...projectSkills,
        ...userSkills,
        ...adminSkills,
        ...pluginSkills,
    ]) {
        if (!dedupedSkills.has(skill.name)) {
            dedupedSkills.set(skill.name, skill);
        }
    }

    return [...dedupedSkills.values()].sort((a, b) => a.name.localeCompare(b.name));
}
