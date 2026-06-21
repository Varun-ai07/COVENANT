import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";
import { createHash } from "crypto";

// ─── Types ───────────────────────────────────────────────────

interface VerificationResult {
  score: number;
  verdict: "pass" | "fail" | "partial";
  checks: CheckResult[];
  summary: string;
  recommendations: string[];
  evidenceHash: string;
  repoUrl: string;
  timestamp: number;
}

interface CheckResult {
  dimension: string;
  score: number;
  details: string;
  issues: string[];
  passed: boolean;
}

// ─── Clone ───────────────────────────────────────────────────

export async function cloneRepo(url: string): Promise<string> {
  // Validate URL to prevent shell injection
  const allowed = /^https:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w.\-]+\/[\w.\-]+/;
  if (!allowed.test(url)) {
    throw new Error(`Invalid repo URL. Only HTTPS GitHub/GitLab/Bitbucket URLs allowed.`);
  }
  const tmpDir = `/tmp/covenant-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  execSync(`git clone --depth 1 --single-branch "${url}" "${tmpDir}"`, {
    timeout: 60000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo" },
    stdio: "pipe",
  });
  return tmpDir;
}

// ─── Main Verification ───────────────────────────────────────

export async function verifyProject(
  repoUrl: string,
  requirements: string,
  depth: "quick" | "standard" | "deep" = "standard"
): Promise<VerificationResult> {
  const repoDir = await cloneRepo(repoUrl);
  const checks: CheckResult[] = [];

  checks.push(await checkCodeQuality(repoDir));
  checks.push(await checkArchitecture(repoDir));
  checks.push(await checkSecurity(repoDir));
  checks.push(await checkPerformance(repoDir));
  checks.push(await checkTesting(repoDir));
  checks.push(await checkDocumentation(repoDir));
  checks.push(await checkDependencies(repoDir));
  checks.push(await checkBestPractices(repoDir));

  // Weighted score
  const weights: Record<string, number> = {
    code_quality: 0.20,
    architecture: 0.15,
    security: 0.20,
    performance: 0.15,
    testing: 0.15,
    documentation: 0.05,
    dependencies: 0.05,
    best_practices: 0.05,
  };

  let totalScore = 0;
  for (const check of checks) {
    totalScore += check.score * (weights[check.dimension] || 0.1);
  }
  const score = Math.round(totalScore);

  const verdict: "pass" | "fail" | "partial" =
    score >= 70 ? "pass" : score >= 40 ? "partial" : "fail";

  const summary = generateSummary(checks, score, requirements);
  const recommendations = generateRecommendations(checks);

  const report = {
    checks,
    score,
    verdict,
    summary,
    recommendations,
    timestamp: Date.now(),
  };
  const evidenceHash = createHash("sha256")
    .update(JSON.stringify(report))
    .digest("hex");

  // Cleanup
  try {
    execSync(`rm -rf ${repoDir}`);
  } catch { /* best-effort cleanup */ }

  return {
    score,
    verdict,
    checks,
    summary,
    recommendations,
    evidenceHash,
    repoUrl,
    timestamp: Date.now(),
  };
}

// ─── Checkers ────────────────────────────────────────────────

async function checkCodeQuality(dir: string): Promise<CheckResult> {
  const issues: string[] = [];
  let score = 100;

  const loc = countLines(dir);
  if (loc < 10) {
    issues.push("Very few lines of code");
    score -= 30;
  }

  const consoleLogs = countPattern(dir, /console\.log\(/g);
  if (consoleLogs > 5) {
    issues.push(`${consoleLogs} console.log statements found`);
    score -= 10;
  }

  const anyTypes = countPattern(dir, /:\s*any/g);
  if (anyTypes > 10) {
    issues.push(`${anyTypes} uses of 'any' type`);
    score -= 15;
  }

  const todos = countPattern(dir, /TODO|FIXME|HACK/gi);
  if (todos > 0) {
    issues.push(`${todos} TODO/FIXME comments`);
    score -= 5;
  }

  // Simple unused import heuristic
  const files = getFiles(dir, [".ts", ".tsx", ".js", ".jsx"]);
  let unusedImports = 0;
  for (const file of files.slice(0, 100)) {
    // cap at 100 files for perf
    const content = readFileSync(file, "utf-8");
    const imports = content.match(/import\s+.*\s+from\s+['"](.+)['"]/g) || [];
    for (const imp of imports) {
      const match = imp.match(/import\s+\{\s*(.+?)\s*\}/);
      if (match) {
        const symbols = match[1].split(",").map((s) => s.trim());
        for (const sym of symbols) {
          if (sym.length > 0 && !content.includes(sym.replace("type ", ""))) {
            unusedImports++;
          }
        }
      }
    }
  }
  if (unusedImports > 5) {
    issues.push(`${unusedImports} potentially unused imports`);
    score -= 5;
  }

  return {
    dimension: "code_quality",
    score: Math.max(0, score),
    details: `LOC: ${loc}, Console logs: ${consoleLogs}, Any types: ${anyTypes}, TODOs: ${todos}`,
    issues,
    passed: score >= 70,
  };
}

async function checkArchitecture(dir: string): Promise<CheckResult> {
  const issues: string[] = [];
  let score = 100;

  const hasSrc =
    existsSync(join(dir, "src")) || existsSync(join(dir, "app"));
  const hasTests =
    existsSync(join(dir, "test")) ||
    existsSync(join(dir, "tests")) ||
    existsSync(join(dir, "__tests__"));
  const hasDocs =
    existsSync(join(dir, "docs")) || existsSync(join(dir, "README.md"));
  const hasConfig =
    existsSync(join(dir, "package.json")) ||
    existsSync(join(dir, "tsconfig.json"));

  if (!hasSrc && !hasConfig) {
    issues.push("No src/ or config found");
    score -= 20;
  }
  if (!hasTests) {
    issues.push("No test directory found");
    score -= 15;
  }
  if (!hasDocs) {
    issues.push("No documentation found");
    score -= 10;
  }

  const fileCount = countFiles(dir);
  if (fileCount < 3) {
    issues.push("Very few files");
    score -= 20;
  }
  if (fileCount > 500) {
    issues.push("Very large codebase (500+ files)");
    score -= 5;
  }

  return {
    dimension: "architecture",
    score: Math.max(0, score),
    details: `Files: ${fileCount}, Has src: ${hasSrc}, Has tests: ${hasTests}, Has docs: ${hasDocs}`,
    issues,
    passed: score >= 70,
  };
}

async function checkSecurity(dir: string): Promise<CheckResult> {
  const issues: string[] = [];
  let score = 100;

  const secretPatterns = [
    /API_KEY\s*=\s*['"][^'"]+['"]/gi,
    /SECRET\s*=\s*['"][^'"]+['"]/gi,
    /PASSWORD\s*=\s*['"][^'"]+['"]/gi,
    /PRIVATE_KEY\s*=\s*['"][^'"]+['"]/gi,
  ];

  for (const pattern of secretPatterns) {
    const matches = countPattern(dir, pattern);
    if (matches > 0) {
      issues.push(`${matches} potential hardcoded secrets`);
      score -= 20;
      break; // one deduction is enough for secrets
    }
  }

  if (existsSync(join(dir, ".env"))) {
    issues.push(".env file committed to repo");
    score -= 15;
  }

  const evals = countPattern(dir, /\beval\s*\(/g);
  if (evals > 0) {
    issues.push(`${evals} eval() usage`);
    score -= 15;
  }

  const innerHTML = countPattern(dir, /innerHTML/g);
  if (innerHTML > 0) {
    issues.push(`${innerHTML} innerHTML usage (XSS risk)`);
    score -= 10;
  }

  const sqlInjection = countPattern(dir, /query\s*\(\s*['"`].*\$\{/g);
  if (sqlInjection > 0) {
    issues.push(`${sqlInjection} potential SQL injection`);
    score -= 20;
  }

  return {
    dimension: "security",
    score: Math.max(0, score),
    details: `Hardcoded secrets checked, eval: ${evals}, innerHTML: ${innerHTML}`,
    issues,
    passed: score >= 70,
  };
}

async function checkPerformance(dir: string): Promise<CheckResult> {
  const issues: string[] = [];
  let score = 100;

  // Check for build output
  const buildDirs = ["dist", "build", ".next"];
  for (const bd of buildDirs) {
    const bdPath = join(dir, bd);
    if (existsSync(bdPath)) {
      const size = getDirSize(bdPath);
      const sizeMB = size / (1024 * 1024);
      if (sizeMB > 10) {
        issues.push(`Bundle size: ${sizeMB.toFixed(1)}MB (very large)`);
        score -= 20;
      } else if (sizeMB > 5) {
        issues.push(`Bundle size: ${sizeMB.toFixed(1)}MB (large)`);
        score -= 10;
      }
      break;
    }
  }

  const largeFiles = findLargeFiles(dir, 1024 * 1024);
  if (largeFiles.length > 0) {
    issues.push(`${largeFiles.length} files larger than 1MB`);
    score -= 10;
  }

  const asyncFiles = countPattern(dir, /async\s+function|async\s*\(/g);
  const totalFiles = countFiles(dir);
  if (totalFiles > 10 && asyncFiles === 0) {
    issues.push("No async/await usage found");
    score -= 5;
  }

  return {
    dimension: "performance",
    score: Math.max(0, score),
    details: `Large files: ${largeFiles.length}, Async usage: ${asyncFiles}`,
    issues,
    passed: score >= 70,
  };
}

async function checkTesting(dir: string): Promise<CheckResult> {
  const issues: string[] = [];
  let score = 100;

  const hasTests =
    existsSync(join(dir, "test")) ||
    existsSync(join(dir, "tests")) ||
    existsSync(join(dir, "__tests__")) ||
    existsSync(join(dir, "spec"));

  if (!hasTests) {
    issues.push("No test files found");
    score -= 50;
  } else {
    const testFiles = getFiles(dir, [
      ".test.ts",
      ".test.js",
      ".spec.ts",
      ".spec.js",
      ".test.tsx",
    ]);
    const sourceFiles = getFiles(dir, [".ts", ".tsx", ".js", ".jsx"]);

    const coverage =
      sourceFiles.length > 0
        ? (testFiles.length / sourceFiles.length) * 100
        : 0;
    if (coverage < 30) {
      issues.push(`Low test coverage: ${coverage.toFixed(0)}%`);
      score -= 20;
    } else if (coverage < 60) {
      issues.push(`Moderate test coverage: ${coverage.toFixed(0)}%`);
      score -= 10;
    }

    let assertionCount = 0;
    for (const testFile of testFiles.slice(0, 50)) {
      const content = readFileSync(testFile, "utf-8");
      assertionCount += (content.match(/expect\(/g) || []).length;
    }
    if (testFiles.length > 0 && assertionCount / testFiles.length < 3) {
      issues.push("Low assertion density in tests");
      score -= 10;
    }
  }

  return {
    dimension: "testing",
    score: Math.max(0, score),
    details: `Tests found: ${hasTests}`,
    issues,
    passed: score >= 70,
  };
}

async function checkDocumentation(dir: string): Promise<CheckResult> {
  const issues: string[] = [];
  let score = 100;

  const readmePath = join(dir, "README.md");
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, "utf-8");
    if (readme.length < 100) {
      issues.push("README is too short (<100 chars)");
      score -= 20;
    }
    if (!readme.includes("#")) {
      issues.push("README has no headers");
      score -= 10;
    }
    if (!readme.includes("```")) {
      issues.push("README has no code examples");
      score -= 5;
    }
  } else {
    issues.push("No README.md found");
    score -= 30;
  }

  const docComments = countPattern(dir, /\/\*\*[\s\S]*?\*\//g);
  if (docComments < 5) {
    issues.push("Few code documentation comments");
    score -= 10;
  }

  return {
    dimension: "documentation",
    score: Math.max(0, score),
    details: `README: ${existsSync(readmePath)}, Doc comments: ${docComments}`,
    issues,
    passed: score >= 70,
  };
}

async function checkDependencies(dir: string): Promise<CheckResult> {
  const issues: string[] = [];
  let score = 100;

  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});

    if (deps.length > 50) {
      issues.push(`${deps.length} dependencies (may be bloated)`);
      score -= 10;
    }
    if (deps.length === 0 && devDeps.length === 0) {
      issues.push("No dependencies declared");
      score -= 10;
    }

    const deprecated = ["lodash", "moment", "request"];
    for (const v of deprecated) {
      if (deps.includes(v)) {
        issues.push(`Uses ${v} (consider alternatives)`);
        score -= 5;
      }
    }
  }

  const hasLock =
    existsSync(join(dir, "package-lock.json")) ||
    existsSync(join(dir, "yarn.lock")) ||
    existsSync(join(dir, "pnpm-lock.yaml"));
  if (!hasLock) {
    issues.push("No lock file found");
    score -= 10;
  }

  return {
    dimension: "dependencies",
    score: Math.max(0, score),
    details: `Dependencies: ${existsSync(pkgPath) ? "found" : "none"}, Lock file: ${hasLock}`,
    issues,
    passed: score >= 70,
  };
}

async function checkBestPractices(dir: string): Promise<CheckResult> {
  const issues: string[] = [];
  let score = 100;

  if (!existsSync(join(dir, ".gitignore"))) {
    issues.push("No .gitignore found");
    score -= 10;
  }

  if (existsSync(join(dir, "tsconfig.json"))) {
    const tsconfig = JSON.parse(readFileSync(join(dir, "tsconfig.json"), "utf-8"));
    if (!tsconfig.compilerOptions?.strict) {
      issues.push("TypeScript strict mode not enabled");
      score -= 10;
    }
  }

  const hasLint =
    existsSync(join(dir, ".eslintrc")) ||
    existsSync(join(dir, ".eslintrc.js")) ||
    existsSync(join(dir, ".eslintrc.json")) ||
    existsSync(join(dir, "eslint.config.js"));
  if (!hasLint) {
    issues.push("No ESLint configuration found");
    score -= 10;
  }

  const tryCatch = countPattern(dir, /try\s*\{/g);
  const asyncFiles = countPattern(dir, /async\s+function|async\s*\(/g);
  if (asyncFiles > 5 && tryCatch < asyncFiles * 0.3) {
    issues.push("Low error handling coverage");
    score -= 10;
  }

  return {
    dimension: "best_practices",
    score: Math.max(0, score),
    details: `Gitignore: ${existsSync(join(dir, ".gitignore"))}, Lint: ${hasLint}`,
    issues,
    passed: score >= 70,
  };
}

// ─── Helpers ─────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "__pycache__",
]);

function countLines(dir: string): number {
  let total = 0;
  const files = getFiles(dir, [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".rs",
    ".sol",
  ]);
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    total += content.split("\n").length;
  }
  return total;
}

function countPattern(dir: string, pattern: RegExp): number {
  let count = 0;
  const files = getFiles(dir, [".ts", ".tsx", ".js", ".jsx", ".py", ".sol"]);
  for (const file of files.slice(0, 200)) {
    const content = readFileSync(file, "utf-8");
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function getFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...getFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function countFiles(dir: string): number {
  return getFiles(dir, [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".rs",
    ".sol",
    ".md",
    ".json",
    ".yaml",
    ".yml",
  ]).length;
}

function getDirSize(dir: string): number {
  let size = 0;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += stat.size;
    }
  }
  return size;
}

function findLargeFiles(dir: string, maxSize: number): string[] {
  const large: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return large;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      large.push(...findLargeFiles(fullPath, maxSize));
    } else if (stat.size > maxSize) {
      large.push(fullPath);
    }
  }
  return large;
}

function generateSummary(
  checks: CheckResult[],
  score: number,
  requirements: string
): string {
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const topIssues = checks.flatMap((c) => c.issues).slice(0, 3);

  return (
    `Score: ${score}/100 (${passed}/${total} checks passed). ` +
    `Requirements: ${requirements}. ` +
    (topIssues.length > 0
      ? `Top issues: ${topIssues.join("; ")}`
      : "No major issues found.")
  );
}

function generateRecommendations(checks: CheckResult[]): string[] {
  const recs: string[] = [];
  for (const check of checks) {
    if (!check.passed) {
      recs.push(
        `Improve ${check.dimension}: ${check.issues[0] || "needs work"}`
      );
    }
  }
  return recs.slice(0, 5);
}
