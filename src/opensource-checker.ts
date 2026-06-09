import { forwardProxy } from "./api";

export interface CheckSignal {
    name: string;
    label: string;
    score: number;   // actual contribution (can be negative)
    max: number;     // maximum possible positive contribution
    details: string;
}

export interface CheckResult {
    checkedAt: string;
    score: number;   // 0–100
    grade: string;
    signals: CheckSignal[];
    error?: string;
}

export type OpenSourceCache = Record<string, CheckResult>;
export const OS_CACHE_FILE = "opensource-cache.json";
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Scoring budget (signals sum to max 100):
//   Source file presence   max +20  min -20
//   Code inspection        max +40  min -40
//   Language composition   max +25  min -15  (gated: 0 if obfuscation detected)
//   CI/release workflow    max  +5  min   0
//   License consistency    max +10  min -10  (modifier keyed on pre-license score)

interface TreeBlob {
    path: string;
    sha: string;
    size: number;
}

function tryJson(s: string): any {
    try { return JSON.parse(s); } catch { return null; }
}

async function ghGet(path: string, token?: string): Promise<any> {
    const url = `https://api.github.com${path}`;
    const headers: Record<string, string>[] = [
        { "Accept": "application/vnd.github.v3+json" },
        { "User-Agent": "siyuan-marketplace-blacklist" },
    ];
    if (token?.trim()) headers.push({ "Authorization": `token ${token.trim()}` });

    const res = await forwardProxy(url, "GET", {}, headers, 20000, "application/json");
    if (!res) throw new Error("Network request failed (null response from proxy)");

    if (res.status === 403) {
        const body = tryJson(res.body);
        if (body?.message?.toLowerCase().includes("rate limit"))
            throw new Error("GitHub API rate limit exceeded — add a token in settings");
        throw new Error(`GitHub API 403: ${body?.message ?? "Forbidden"}`);
    }
    if (res.status === 404) throw new Error("Repository not found (404)");
    if (res.status >= 400) throw new Error(`GitHub API error ${res.status}`);

    const parsed = tryJson(res.body);
    if (parsed === null && res.body?.length > 0) throw new Error("Non-JSON response from GitHub");
    return parsed;
}

export function gradeFromScore(score: number): string {
    if (score >= 80) return "Very Likely Open Source";
    if (score >= 60) return "Probably Open Source";
    if (score >= 40) return "Uncertain";
    if (score >= 20) return "Possibly Closed Source";
    return "Very Likely Closed Source";
}

// ─── File tree analysis ───────────────────────────────────────────────────────

function categorizeBlobs(tree: any[]): {
    srcBlobs: TreeBlob[];    // src/**/*.{ts,js,cjs} or root *.ts (not .d.ts, not .min.)
    ambigBlobs: TreeBlob[];  // root or lib *.{js,cjs} outside dist (ambiguous origin)
    distBlobs: TreeBlob[];   // dist/**/*.{js,cjs} or *.min.{js,cjs}
} {
    const srcBlobs: TreeBlob[] = [];
    const ambigBlobs: TreeBlob[] = [];
    const distBlobs: TreeBlob[] = [];

    for (const f of tree) {
        if (f.type !== "blob" || !f.path || !f.sha) continue;
        const p: string = f.path;
        if (!p.endsWith(".ts") && !p.endsWith(".js") && !p.endsWith(".cjs") && !p.endsWith(".mjs")) continue;
        if (p.includes("node_modules/")) continue;
        if (p.endsWith(".d.ts")) continue;

        const blob: TreeBlob = { path: p, sha: f.sha, size: f.size ?? 0 };

        if (p.includes("/dist/") || p.startsWith("dist/") || p.endsWith(".min.js") || p.endsWith(".min.cjs")) {
            distBlobs.push(blob);
        } else if (p.startsWith("src/") || (!p.includes("/") && p.endsWith(".ts"))) {
            srcBlobs.push(blob);
        } else {
            ambigBlobs.push(blob);
        }
    }

    return { srcBlobs, ambigBlobs, distBlobs };
}

function sigSourcePresence(cats: ReturnType<typeof categorizeBlobs>): {
    signal: CheckSignal;
    candidates: TreeBlob[];
} {
    const { srcBlobs, ambigBlobs, distBlobs } = cats;

    // Always sort candidates largest-first so obfuscation check hits the biggest files
    const sortDesc = (a: TreeBlob, b: TreeBlob) => b.size - a.size;

    if (srcBlobs.length > 0) {
        return {
            signal: { name: "presence", label: "Source file presence", score: 20, max: 20, details: `${srcBlobs.length} source file(s) found in src/ or root (TypeScript/JS)` },
            candidates: [...srcBlobs].sort(sortDesc).slice(0, 5),
        };
    }
    if (ambigBlobs.length > 0) {
        const total = ambigBlobs.length;
        return {
            signal: { name: "presence", label: "Source file presence", score: 0, max: 20, details: `${total} JavaScript file(s) found outside src/ — origin ambiguous (no src/ directory)` },
            candidates: [...ambigBlobs].sort(sortDesc).slice(0, 5),
        };
    }
    if (distBlobs.length > 0) {
        return {
            signal: { name: "presence", label: "Source file presence", score: -15, max: 20, details: `Only compiled/dist output found — no source code in repository` },
            candidates: [...distBlobs].sort(sortDesc).slice(0, 3),
        };
    }
    return {
        signal: { name: "presence", label: "Source file presence", score: -20, max: 20, details: "No JavaScript or TypeScript files found in repository" },
        candidates: [],
    };
}

// ─── Obfuscation heuristics ───────────────────────────────────────────────────

function detectObfuscation(content: string): { suspicion: number; reasons: string[] } {
    const reasons: string[] = [];
    let s = 0;

    // Bytes-per-line ratio (KEY SIGNAL: obfuscated code collapses to few lines)
    const nonEmptyLines = content.split("\n").filter(l => l.trim().length > 0);
    const lineCount = Math.max(nonEmptyLines.length, 1);
    const bytesPerLine = content.length / lineCount;

    if (bytesPerLine > 8000) {
        s += 50;
        reasons.push(`${bytesPerLine.toFixed(0)} B/line (${lineCount} lines, ${(content.length / 1024).toFixed(1)} KB) — extreme`);
    } else if (bytesPerLine > 3000) {
        s += 35;
        reasons.push(`${bytesPerLine.toFixed(0)} B/line — heavily minified or obfuscated`);
    } else if (bytesPerLine > 1000) {
        s += 20;
        reasons.push(`${bytesPerLine.toFixed(0)} B/line — suspicious`);
    } else if (bytesPerLine > 400) {
        s += 8;
        reasons.push(`${bytesPerLine.toFixed(0)} B/line — possibly minified`);
    }

    // Dense hex-escaped characters (\x41\x42…)
    const hexCount = (content.match(/\\x[0-9a-fA-F]{2}/g) ?? []).length;
    if (hexCount > 0 && content.length > 0 && hexCount / content.length > 0.008) {
        s += 25;
        reasons.push(`Dense hex-encoded characters (${hexCount}×)`);
    }

    // eval() / new Function() abuse
    const evalCount = (content.match(/\beval\s*\(/g) ?? []).length;
    if (evalCount > 2) { s += 20; reasons.push(`eval() called ${evalCount}×`); }

    const funcCtor = (content.match(/new\s+Function\s*\(/g) ?? []).length;
    if (funcCtor > 2) { s += 20; reasons.push(`new Function() called ${funcCtor}×`); }

    const fromCharCode = (content.match(/String\.fromCharCode\s*\(/g) ?? []).length;
    if (fromCharCode > 3) { s += 15; reasons.push(`String.fromCharCode used ${fromCharCode}×`); }

    // Identifier mangling: dominant single/double-char names
    const ids = content.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) ?? [];
    if (ids.length > 100) {
        const shortCount = ids.filter(id => id.length <= 2 && /^[a-z_$]/i.test(id)).length;
        const ratio = shortCount / ids.length;
        if (ratio > 0.5) { s += 20; reasons.push(`${(ratio * 100).toFixed(0)}% short identifiers — name-mangled`); }
    }

    // String-array pattern (large encoded string lookup table)
    if (/=\s*\[(?:["'][^"']{0,100}["'],?\s*){15,}\]/.test(content)) {
        s += 20;
        reasons.push("String-array pattern detected (common obfuscation technique)");
    }

    // Large base64 blobs embedded in code
    const b64Count = (content.match(/['"][A-Za-z0-9+/]{80,}={0,2}['"]/g) ?? []).length;
    if (b64Count > 3) { s += 15; reasons.push(`${b64Count} large base64-encoded strings`); }

    return { suspicion: Math.min(s, 100), reasons };
}

async function sigCodeInspection(
    candidates: TreeBlob[],
    owner: string,
    repo: string,
    token?: string
): Promise<CheckSignal> {
    if (candidates.length === 0) {
        // No files available means the presence signal already gave a negative score;
        // code inspection also penalizes independently — cannot pass without visible code.
        return { name: "obfuscation", label: "Code inspection", score: -40, max: 40, details: "No source files available for inspection — cannot verify code authenticity" };
    }

    let worstSuspicion = 0;
    const allReasons: string[] = [];
    let analyzed = 0;
    let totalKb = 0;

    for (const file of candidates) {
        try {
            // Use blob SHA API — handles files >1 MB correctly (Contents API silently truncates those)
            const data = await ghGet(`/repos/${owner}/${repo}/git/blobs/${file.sha}`, token);
            if (data?.encoding === "base64" && data?.content) {
                const decoded = atob(data.content.replace(/\s/g, ""));
                const { suspicion, reasons } = detectObfuscation(decoded);
                if (suspicion > worstSuspicion) worstSuspicion = suspicion;
                if (reasons.length > 0) {
                    const fname = file.path.split("/").pop() ?? file.path;
                    allReasons.push(...reasons.map(r => `[${fname}] ${r}`));
                }
                analyzed++;
                totalKb += decoded.length / 1024;
            }
        } catch { /* skip individual file fetch error */ }
    }

    // Failed to read any file — treat as unverified, NOT as passing
    if (analyzed === 0) {
        return { name: "obfuscation", label: "Code inspection", score: -20, max: 40, details: "Could not read source files for inspection — unverified" };
    }

    const summary = allReasons.slice(0, 3).join("; ");
    if (worstSuspicion >= 60) return { name: "obfuscation", label: "Code inspection", score: -40, max: 40, details: `Heavy obfuscation: ${summary}` };
    if (worstSuspicion >= 30) return { name: "obfuscation", label: "Code inspection", score: -20, max: 40, details: `Obfuscation indicators found: ${summary}` };
    return { name: "obfuscation", label: "Code inspection", score: 40, max: 40, details: `Analyzed ${analyzed} file(s) (${totalKb.toFixed(0)} KB) — no obfuscation detected` };
}

// ─── Language composition (gated by obfuscation result) ──────────────────────

function sigLanguageBytes(langData: Record<string, number>, obfuscationScore: number): CheckSignal {
    const total = Object.values(langData).reduce((a, b) => a + b, 0);
    if (total === 0) {
        return { name: "languages", label: "Language composition", score: -15, max: 25, details: "No language statistics — repository may contain no recognized source code" };
    }

    const tsRatio = (langData["TypeScript"] ?? 0) / total;
    const jsRatio = (langData["JavaScript"] ?? 0) / total;
    const totalKb = total / 1024;

    const top = Object.entries(langData)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
        .map(([lang, bytes]) => `${lang}:${(bytes / total * 100).toFixed(0)}%`)
        .join(" ");

    let score: number;
    let details: string;

    if (tsRatio > 0.5) {
        score = 25; details = `TypeScript-dominant (${(tsRatio * 100).toFixed(0)}%, ${totalKb.toFixed(0)} KB total). ${top}`;
    } else if (tsRatio > 0.2) {
        score = 15; details = `Significant TypeScript (${(tsRatio * 100).toFixed(0)}%). ${top}`;
    } else if (jsRatio > 0.8 && totalKb > 50) {
        score = 5; details = `JavaScript-only, substantial (${totalKb.toFixed(0)} KB). ${top}`;
    } else if (jsRatio > 0.8 && totalKb <= 50) {
        score = -5; details = `JavaScript-only, small codebase (${totalKb.toFixed(0)} KB). ${top}`;
    } else {
        score = 8; details = `Mixed/other languages. ${top}`;
    }

    // Gate: if code inspection found obfuscation, don't let language bytes carry a positive score —
    // the bytes may have been padded precisely to fake a healthy language distribution.
    if (obfuscationScore < 0 && score > 0) {
        return { name: "languages", label: "Language composition", score: 0, max: 25, details: `${details} — positive signal withheld: obfuscation was detected` };
    }

    return { name: "languages", label: "Language composition", score, max: 25, details };
}

// ─── CI / release workflow ────────────────────────────────────────────────────

async function sigReleases(owner: string, repo: string, token?: string): Promise<CheckSignal> {
    try {
        const releases = await ghGet(`/repos/${owner}/${repo}/releases?per_page=3`, token);
        if (!Array.isArray(releases) || releases.length === 0) {
            return { name: "releases", label: "CI/Release workflow", score: 0, max: 5, details: "No releases found" };
        }
        const login: string = releases[0]?.author?.login ?? "unknown";
        const isBot = releases[0]?.author?.type === "Bot" || login.includes("[bot]");
        if (isBot) return { name: "releases", label: "CI/Release workflow", score: 5, max: 5, details: `Released by ${login} (automated CI — positive)` };
        return { name: "releases", label: "CI/Release workflow", score: 0, max: 5, details: `Released manually by @${login}` };
    } catch {
        return { name: "releases", label: "CI/Release workflow", score: 0, max: 5, details: "Could not check release history" };
    }
}

// ─── License consistency (modifier keyed on pre-license score) ───────────────

const OSS_SPDX = new Set([
    "MIT", "Apache-2.0", "GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0",
    "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0", "CC0-1.0", "Unlicense", "WTFPL",
    "GPL-2.0-only", "GPL-3.0-only", "AGPL-3.0-only", "LGPL-2.1-only", "LGPL-3.0-only",
]);

async function sigLicense(owner: string, repo: string, token: string | undefined, preLicenseRaw: number): Promise<CheckSignal> {
    let spdx: string | null = null;
    try {
        const data = await ghGet(`/repos/${owner}/${repo}/license`, token);
        spdx = data?.license?.spdx_id ?? null;
        if (spdx === "NOASSERTION") spdx = null;
    } catch { /* no license file */ }

    const hasOss = spdx !== null && OSS_SPDX.has(spdx);
    const noLicense = spdx === null;

    const suspicious = preLicenseRaw < 40;

    if (suspicious) {
        // Code looks closed/obfuscated — evaluate license in that context
        if (hasOss) return { name: "license", label: "License consistency", score: -10, max: 10, details: `${spdx} declared but code shows closed-source indicators — likely deceptive` };
        if (noLicense) return { name: "license", label: "License consistency", score: 0, max: 10, details: "No license file (consistent with closed-source indicators)" };
        return { name: "license", label: "License consistency", score: 3, max: 10, details: `${spdx ?? "Unknown"} license (proprietary — at least consistent with findings)` };
    } else {
        // Code looks open — does the license match?
        if (hasOss) return { name: "license", label: "License consistency", score: 10, max: 10, details: `${spdx} license consistent with open-source code` };
        if (noLicense) return { name: "license", label: "License consistency", score: -3, max: 10, details: "No license file (code looks open but licensing unclear)" };
        return { name: "license", label: "License consistency", score: -5, max: 10, details: `${spdx ?? "Unknown"} license — code looks open but license is restrictive/proprietary` };
    }
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function checkOpenSource(owner: string, repo: string, token?: string): Promise<CheckResult> {
    try {
        const [repoData, langData] = await Promise.all([
            ghGet(`/repos/${owner}/${repo}`, token),
            ghGet(`/repos/${owner}/${repo}/languages`, token),
        ]);

        const branch: string = repoData?.default_branch ?? "HEAD";
        const treeData = await ghGet(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token);
        if (!treeData?.tree) throw new Error("Could not retrieve repository file tree");

        if (treeData.truncated) {
            // Tree was truncated (very large repo); note it but continue with what we have
            console.warn(`[os-checker] File tree for ${owner}/${repo} was truncated — working with partial list`);
        }

        const cats = categorizeBlobs(treeData.tree as any[]);
        const { signal: presenceSignal, candidates } = sigSourcePresence(cats);

        // Analyze the LARGEST candidates first (sort already done in sigSourcePresence)
        const [obfuscationSignal, releasesSignal] = await Promise.all([
            sigCodeInspection(candidates, owner, repo, token),
            sigReleases(owner, repo, token),
        ]);

        const langSignal = sigLanguageBytes((langData as Record<string, number>) ?? {}, obfuscationSignal.score);

        const preLicenseRaw = presenceSignal.score + obfuscationSignal.score + langSignal.score + releasesSignal.score;
        const licenseSignal = await sigLicense(owner, repo, token, preLicenseRaw);

        const signals: CheckSignal[] = [presenceSignal, obfuscationSignal, langSignal, releasesSignal, licenseSignal];
        const rawScore = signals.reduce((acc, s) => acc + s.score, 0);
        const score = Math.max(0, Math.min(100, rawScore));

        return { checkedAt: new Date().toISOString(), score, grade: gradeFromScore(score), signals };
    } catch (e: any) {
        return {
            checkedAt: new Date().toISOString(),
            score: 0,
            grade: "Analysis Failed",
            signals: [],
            error: e?.message ?? String(e),
        };
    }
}

export function isCacheStale(result: CheckResult): boolean {
    return Date.now() - new Date(result.checkedAt).getTime() > CACHE_TTL_MS;
}
