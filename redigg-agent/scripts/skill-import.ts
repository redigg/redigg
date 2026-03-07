import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getConfig } from '../src/config';

type Command = 'list' | 'validate' | 'import';
type Severity = 'low' | 'medium' | 'high';

interface LicensePolicy {
  allowed: string[];
  note?: string;
}

interface SkillSource {
  repo: string;
  path: string;
  branch?: string;
  license?: string;
}

interface SkillEntry {
  id: string;
  name: string;
  description?: string;
  version?: string;
  approved?: boolean;
  tags?: string[];
  source: SkillSource;
}

interface SkillManifest {
  manifest_version: number;
  generated_at?: string;
  default_branch?: string;
  license_policy: LicensePolicy;
  skills: SkillEntry[];
}

interface PatternRule {
  id: string;
  severity: Severity;
  pattern: string;
  flags?: string;
  reason: string;
}

interface SecurityRules {
  manifest_version: number;
  max_markdown_bytes?: number;
  blocked_patterns: PatternRule[];
  warn_patterns: PatternRule[];
}

interface RuleHit {
  id: string;
  severity: Severity;
  reason: string;
  sample: string;
}

interface ValidationResult {
  skill: SkillEntry;
  rawUrl: string;
  licenseAllowed: boolean;
  markdown?: string;
  markdownSha256?: string;
  markdownBytes?: number;
  blocked: RuleHit[];
  warnings: RuleHit[];
  errors: string[];
}

interface CliOptions {
  command: Command;
  manifestPath: string;
  rulesPath: string;
  apiBase: string;
  apiKey: string;
  onlyApproved: boolean;
  apply: boolean;
  strictWarnings: boolean;
  limit?: number;
  ids?: Set<string>;
}

interface CompiledRule {
  rule: PatternRule;
  regex: RegExp;
}

function usage() {
  console.log(`Usage:
  tsx scripts/skill-import.ts list [--manifest <path>] [--only-approved] [--limit <n>]
  tsx scripts/skill-import.ts validate [--manifest <path>] [--rules <path>] [--only-approved] [--ids <id1,id2>]
  tsx scripts/skill-import.ts import [--manifest <path>] [--rules <path>] [--only-approved] [--apply]

Flags:
  --manifest <path>         Manifest JSON path (default: configs/skill-import-whitelist.json)
  --rules <path>            Security rules JSON path (default: configs/skill-import-security-rules.json)
  --api-base <url>          Skill API base URL (default: config redigg.apiBase or REDIGG_API_BASE)
  --api-key <key>           Skill API key (default: config redigg.apiKey or REDIGG_API_KEY)
  --only-approved           Select only approved=true entries
  --include-unapproved      Include approved=false entries
  --ids <a,b,c>             Restrict to specific skill IDs
  --limit <n>               Limit number of selected skills
  --apply                   Actually import (without this flag: dry-run)
  --strict-warnings         Treat warning rules as blocking
`);
}

function parseArgs(argv: string[]): CliOptions {
  const first = argv[0];
  if (!first || first === '--help' || first === '-h') {
    usage();
    process.exit(0);
  }

  const command = (['list', 'validate', 'import'].includes(first) ? first : 'list') as Command;
  const args = command === first ? argv.slice(1) : argv.slice(0);

  const manifestPath = path.resolve(process.cwd(), 'configs/skill-import-whitelist.json');
  const rulesPath = path.resolve(process.cwd(), 'configs/skill-import-security-rules.json');
  let apiBase = getConfig('redigg.apiBase', 'REDIGG_API_BASE') || 'https://redigg.com';
  let apiKey = getConfig('redigg.apiKey', 'REDIGG_API_KEY') || '';
  let onlyApproved = command === 'import';
  let apply = false;
  let strictWarnings = false;
  let limit: number | undefined;
  let ids: Set<string> | undefined;
  let manifest = manifestPath;
  let rules = rulesPath;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--manifest') {
      manifest = path.resolve(process.cwd(), args[++i] || '');
      continue;
    }
    if (token === '--rules') {
      rules = path.resolve(process.cwd(), args[++i] || '');
      continue;
    }
    if (token === '--api-base') {
      apiBase = (args[++i] || '').trim();
      continue;
    }
    if (token === '--api-key') {
      apiKey = (args[++i] || '').trim();
      continue;
    }
    if (token === '--only-approved') {
      onlyApproved = true;
      continue;
    }
    if (token === '--include-unapproved') {
      onlyApproved = false;
      continue;
    }
    if (token === '--apply') {
      apply = true;
      continue;
    }
    if (token === '--strict-warnings') {
      strictWarnings = true;
      continue;
    }
    if (token === '--limit') {
      const value = Number(args[++i] || '');
      if (Number.isFinite(value) && value > 0) {
        limit = value;
      }
      continue;
    }
    if (token === '--ids') {
      const raw = (args[++i] || '').trim();
      if (raw) {
        ids = new Set(
          raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        );
      }
      continue;
    }
  }

  return {
    command,
    manifestPath: manifest,
    rulesPath: rules,
    apiBase,
    apiKey,
    onlyApproved,
    apply,
    strictWarnings,
    limit,
    ids,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function normalizeLicense(license?: string): string {
  return (license || '').trim().toLowerCase();
}

function licenseAllowed(skill: SkillEntry, policy: LicensePolicy): boolean {
  const target = normalizeLicense(skill.source.license);
  if (!target) return false;
  const allowed = new Set(policy.allowed.map(normalizeLicense));
  return allowed.has(target);
}

function toRawGithubUrl(skill: SkillEntry, defaultBranch = 'main'): string {
  const branch = (skill.source.branch || defaultBranch || 'main').trim();
  return `https://raw.githubusercontent.com/${skill.source.repo}/${branch}/${skill.source.path}`;
}

function selectSkills(manifest: SkillManifest, options: CliOptions): SkillEntry[] {
  let list = [...manifest.skills];
  if (options.onlyApproved) {
    list = list.filter((skill) => skill.approved === true);
  }
  if (options.ids && options.ids.size > 0) {
    list = list.filter((skill) => options.ids!.has(skill.id));
  }
  if (typeof options.limit === 'number') {
    list = list.slice(0, options.limit);
  }
  return list;
}

function formatTags(tags?: string[]): string {
  if (!Array.isArray(tags) || tags.length === 0) return '-';
  return tags.join(',');
}

function compileRule(rule: PatternRule): CompiledRule {
  const rawFlags = (rule.flags || 'i').replace(/g/g, '');
  const dedupFlags = Array.from(new Set(rawFlags.split(''))).join('');
  return {
    rule,
    regex: new RegExp(rule.pattern, dedupFlags),
  };
}

function extractSnippet(content: string, regex: RegExp): string {
  const match = content.match(regex);
  if (!match || typeof match.index !== 'number') return '';
  const start = Math.max(0, match.index - 36);
  const end = Math.min(content.length, match.index + match[0].length + 36);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

function runRuleSet(content: string, rules: CompiledRule[]): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const item of rules) {
    if (!item.regex.test(content)) continue;
    hits.push({
      id: item.rule.id,
      severity: item.rule.severity,
      reason: item.rule.reason,
      sample: extractSnippet(content, item.regex),
    });
  }
  return hits;
}

async function fetchSkillMarkdown(rawUrl: string): Promise<string> {
  const res = await axios.get(rawUrl, {
    responseType: 'text',
    timeout: 30000,
    transformResponse: [(data) => data],
  });
  return typeof res.data === 'string' ? res.data : String(res.data || '');
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function buildSkillParameters(skill: SkillEntry, hash: string) {
  return {
    type: 'object',
    additionalProperties: true,
    properties: {
      topic: {
        type: 'string',
        description: 'Research topic or problem statement.',
      },
      context: {
        type: 'string',
        description: 'Optional background/context for this task.',
      },
      task_type: {
        type: 'string',
        description: 'Optional task type hint from upstream scheduler.',
      },
    },
    required: ['topic'],
    x_redigg_import: {
      source_repo: skill.source.repo,
      source_path: skill.source.path,
      source_license: skill.source.license || '',
      imported_at: new Date().toISOString(),
      content_sha256: hash,
      tags: skill.tags || [],
    },
  };
}

async function validateSkill(
  manifest: SkillManifest,
  rules: SecurityRules,
  skill: SkillEntry
): Promise<ValidationResult> {
  const rawUrl = toRawGithubUrl(skill, manifest.default_branch || 'main');
  const blockedRules = rules.blocked_patterns.map(compileRule);
  const warnRules = rules.warn_patterns.map(compileRule);
  const errors: string[] = [];
  let markdown = '';
  let bytes = 0;
  let hash = '';
  let blocked: RuleHit[] = [];
  let warnings: RuleHit[] = [];

  const allowed = licenseAllowed(skill, manifest.license_policy);
  if (!allowed) {
    errors.push(
      `License "${skill.source.license || 'UNKNOWN'}" is not in allowlist: ${manifest.license_policy.allowed.join(', ')}`
    );
  }

  try {
    markdown = await fetchSkillMarkdown(rawUrl);
  } catch (error) {
    const message = (error as AxiosError).message || String(error);
    errors.push(`Failed to fetch markdown from ${rawUrl}: ${message}`);
    return {
      skill,
      rawUrl,
      licenseAllowed: allowed,
      blocked,
      warnings,
      errors,
    };
  }

  bytes = Buffer.byteLength(markdown, 'utf8');
  hash = sha256(markdown);

  if ((rules.max_markdown_bytes || 0) > 0 && bytes > (rules.max_markdown_bytes || 0)) {
    errors.push(`Markdown too large (${bytes} bytes > max ${rules.max_markdown_bytes})`);
  }

  blocked = runRuleSet(markdown, blockedRules);
  warnings = runRuleSet(markdown, warnRules);

  return {
    skill,
    rawUrl,
    licenseAllowed: allowed,
    markdown,
    markdownSha256: hash,
    markdownBytes: bytes,
    blocked,
    warnings,
    errors,
  };
}

function printManifestSummary(manifest: SkillManifest, selected: SkillEntry[]) {
  console.log(`Manifest: ${manifest.manifest_version} | Generated: ${manifest.generated_at || '-'}`);
  console.log(`License policy: ${manifest.license_policy.allowed.join(', ')}`);
  console.log(`Selected skills: ${selected.length}/${manifest.skills.length}`);
  console.log('');
  for (const skill of selected) {
    const approvedMark = skill.approved ? 'yes' : 'no';
    const license = skill.source.license || 'UNKNOWN';
    console.log(
      `- ${skill.id} | approved=${approvedMark} | license=${license} | repo=${skill.source.repo} | path=${skill.source.path} | tags=${formatTags(skill.tags)}`
    );
  }
}

function printValidationSummary(results: ValidationResult[]) {
  let pass = 0;
  let blocked = 0;
  let failed = 0;
  for (const result of results) {
    if (result.errors.length > 0) {
      failed += 1;
      continue;
    }
    if (result.blocked.length > 0) {
      blocked += 1;
      continue;
    }
    pass += 1;
  }

  console.log('');
  console.log(`Validation summary: pass=${pass}, blocked=${blocked}, failed=${failed}, total=${results.length}`);
  console.log('');

  for (const result of results) {
    const status =
      result.errors.length > 0 ? 'FAILED' : result.blocked.length > 0 ? 'BLOCKED' : 'PASS';
    const warnCount = result.warnings.length;
    const bytes = result.markdownBytes ?? 0;
    console.log(`[${status}] ${result.skill.id} | bytes=${bytes} | warnings=${warnCount} | sha256=${result.markdownSha256 || '-'}`);

    for (const err of result.errors) {
      console.log(`  error: ${err}`);
    }
    for (const hit of result.blocked) {
      console.log(`  blocked: ${hit.id} (${hit.severity}) - ${hit.reason}`);
      if (hit.sample) console.log(`    sample: ${hit.sample}`);
    }
    for (const hit of result.warnings) {
      console.log(`  warn: ${hit.id} (${hit.severity}) - ${hit.reason}`);
    }
  }
}

async function importOne(result: ValidationResult, options: CliOptions) {
  if (!result.markdown || !result.markdownSha256) {
    return { ok: false, reason: 'missing markdown content' };
  }

  if (result.errors.length > 0) {
    return { ok: false, reason: `validation errors: ${result.errors.join('; ')}` };
  }

  if (result.blocked.length > 0) {
    return { ok: false, reason: `blocked by rules: ${result.blocked.map((h) => h.id).join(', ')}` };
  }

  if (options.strictWarnings && result.warnings.length > 0) {
    return { ok: false, reason: `warnings treated as blocking: ${result.warnings.map((h) => h.id).join(', ')}` };
  }

  const skill = result.skill;
  const version = skill.version || '1.0.0';
  const parameters = buildSkillParameters(skill, result.markdownSha256);

  if (!options.apply) {
    return { ok: true, reason: 'dry-run', imported: false };
  }

  if (!options.apiKey) {
    return { ok: false, reason: 'missing API key (set redigg.apiKey or REDIGG_API_KEY)' };
  }

  const headers = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const createRes = await axios.post(
      `${options.apiBase.replace(/\/$/, '')}/api/skills`,
      {
        id: skill.id,
        name: skill.name,
        description: skill.description || '',
        parameters,
        version,
      },
      { headers, timeout: 30000 }
    );

    if (!createRes.data?.success) {
      return { ok: false, reason: `create failed: ${JSON.stringify(createRes.data)}` };
    }
  } catch (error) {
    const message = (error as AxiosError).message || String(error);
    return { ok: false, reason: `create request failed: ${message}` };
  }

  try {
    const submitRes = await axios.post(
      `${options.apiBase.replace(/\/$/, '')}/api/skills/${encodeURIComponent(skill.id)}/submit`,
      {
        version,
        content: result.markdown,
        parameters,
      },
      { headers, timeout: 30000 }
    );

    if (!submitRes.data?.success) {
      return { ok: false, reason: `submit failed: ${JSON.stringify(submitRes.data)}` };
    }
  } catch (error) {
    const message = (error as AxiosError).message || String(error);
    return { ok: false, reason: `submit request failed: ${message}` };
  }

  return { ok: true, reason: 'imported', imported: true };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await readJsonFile<SkillManifest>(options.manifestPath);
  const selected = selectSkills(manifest, options);

  if (selected.length === 0) {
    console.log('No skills selected with current filters.');
    return;
  }

  if (options.command === 'list') {
    printManifestSummary(manifest, selected);
    return;
  }

  const rules = await readJsonFile<SecurityRules>(options.rulesPath);
  const results: ValidationResult[] = [];

  for (const skill of selected) {
    console.log(`Validating ${skill.id} ...`);
    results.push(await validateSkill(manifest, rules, skill));
  }

  printValidationSummary(results);

  if (options.command === 'validate') {
    return;
  }

  const dryRunLabel = options.apply ? 'apply mode' : 'dry-run mode';
  console.log('');
  console.log(`Import step (${dryRunLabel}): apiBase=${options.apiBase}`);

  let imported = 0;
  let skipped = 0;

  for (const result of results) {
    const action = await importOne(result, options);
    if (action.ok) {
      if (action.imported) imported += 1;
      console.log(`[OK] ${result.skill.id}: ${action.reason}`);
    } else {
      skipped += 1;
      console.log(`[SKIP] ${result.skill.id}: ${action.reason}`);
    }
  }

  console.log('');
  console.log(`Import summary: imported=${imported}, skipped=${skipped}, total=${results.length}`);
}

main().catch((error) => {
  console.error('skill-import script failed:', error);
  process.exit(1);
});
