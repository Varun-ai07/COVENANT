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
export declare function cloneRepo(url: string): Promise<string>;
export declare function verifyProject(repoUrl: string, requirements: string, depth?: "quick" | "standard" | "deep"): Promise<VerificationResult>;
export {};
//# sourceMappingURL=verify.d.ts.map