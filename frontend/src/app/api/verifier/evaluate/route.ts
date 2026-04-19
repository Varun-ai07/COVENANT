import { NextResponse } from "next/server";

interface VerificationRequest {
  taskId: number;
  deliverableHash: string;
  descriptionHash?: string;
  deadline?: number;
  createdAt?: number;
}

interface EngineCriterion {
  id: string;
  label: string;
  stage: 1 | 2 | 3;
  weight: number;
  passed: boolean;
  details: string;
}

interface DeliverableContent {
  raw: string;
  parsed: Record<string, unknown> | null;
}

function toGatewayUrl(hash: string): string {
  const cleaned = hash.replace("ipfs://", "").trim();
  return `https://ipfs.io/ipfs/${cleaned}`;
}

async function fetchIpfsContent(hash?: string): Promise<DeliverableContent | null> {
  if (!hash) return null;

  const trimmed = hash.trim();
  if (!trimmed || trimmed === "0x" || trimmed === "0") return null;

  const gatewayUrl = toGatewayUrl(trimmed);
  const response = await fetch(gatewayUrl, {
    method: "GET",
    headers: { Accept: "application/json,text/plain,*/*" },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { raw, parsed };
  } catch {
    return { raw, parsed: null };
  }
}

function computeWeightedScore(criteria: EngineCriterion[]): number {
  const totalWeight = criteria.reduce((acc, item) => acc + item.weight, 0);
  if (totalWeight === 0) return 0;

  const earned = criteria.reduce((acc, item) => {
    return item.passed ? acc + item.weight : acc;
  }, 0);

  return Math.round((earned / totalWeight) * 100);
}

function getReportLength(deliverable: DeliverableContent | null): number {
  if (!deliverable) return 0;

  const parsedReport = deliverable.parsed?.report;
  if (typeof parsedReport === "string") {
    return parsedReport.length;
  }

  return deliverable.raw.length;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerificationRequest;

    if (!body || typeof body.taskId !== "number") {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const deliverable = await fetchIpfsContent(body.deliverableHash);
    const specSource = await fetchIpfsContent(body.descriptionHash);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const deadline = typeof body.deadline === "number" ? body.deadline : 0;
    const reportLength = getReportLength(deliverable);
    const deliverableAsJson = !!deliverable?.parsed;

    const criteria: EngineCriterion[] = [
      {
        id: "S1-C001",
        label: "Deliverable hash provided",
        stage: 1,
        weight: 12,
        passed: !!body.deliverableHash && body.deliverableHash !== "0x",
        details: body.deliverableHash ? "Deliverable hash detected" : "Missing deliverable hash",
      },
      {
        id: "S1-C002",
        label: "Deliverable retrievable from IPFS",
        stage: 1,
        weight: 18,
        passed: !!deliverable,
        details: deliverable ? "Deliverable downloaded from gateway" : "Unable to retrieve deliverable",
      },
      {
        id: "S1-C003",
        label: "Submission before deadline",
        stage: 1,
        weight: 10,
        passed: deadline === 0 || deadline >= nowSeconds,
        details: deadline === 0 ? "No deadline constraint" : deadline >= nowSeconds ? "Task is within deadline" : "Task appears past deadline",
      },
      {
        id: "S2-C001",
        label: "Machine-readable deliverable format",
        stage: 2,
        weight: 12,
        passed: deliverableAsJson,
        details: deliverableAsJson ? "Deliverable JSON detected" : "Deliverable is not valid JSON",
      },
      {
        id: "S2-C002",
        label: "Specification data available",
        stage: 2,
        weight: 10,
        passed: !!specSource,
        details: specSource ? "Task specification loaded" : "Task specification unavailable via IPFS",
      },
      {
        id: "S2-C003",
        label: "Verification evidence completeness",
        stage: 2,
        weight: 14,
        passed: reportLength >= 120,
        details: reportLength >= 120 ? "Deliverable includes substantial evidence" : "Evidence report is too short",
      },
      {
        id: "S3-C001",
        label: "Qualitative clarity heuristic",
        stage: 3,
        weight: 14,
        passed: reportLength >= 300,
        details: reportLength >= 300 ? "Detailed explanation present" : "Limited qualitative detail",
      },
    ];

    const deterministicScore = computeWeightedScore(criteria);

    // Lightweight LLM-assist surrogate to keep the pipeline online without external model dependency.
    const llmScore = Math.max(0, Math.min(100, Math.round(reportLength / 8)));

    const finalScore = Math.round(deterministicScore * 0.7 + llmScore * 0.3);
    const blockingFailed = criteria.some((item) => item.stage === 1 && !item.passed);
    const success = !blockingFailed && finalScore >= 70;

    const feedback = success
      ? "Deliverable passed staged checks and met quality threshold."
      : "Deliverable failed one or more blocking checks or scored below threshold.";

    return NextResponse.json({
      engine: "COVENANT Verification Engine",
      taskId: body.taskId,
      success,
      score: finalScore,
      deterministicScore,
      llmScore,
      feedback,
      criteria,
      pipeline: {
        stage1Passed: criteria.filter((c) => c.stage === 1).every((c) => c.passed),
        stage2Passed: criteria.filter((c) => c.stage === 2).some((c) => c.passed),
        stage3Assessed: true,
        threshold: 70,
      },
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Verifier engine evaluation error:", error);
    return NextResponse.json({ error: "Failed to evaluate task" }, { status: 500 });
  }
}
