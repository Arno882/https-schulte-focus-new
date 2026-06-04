import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success: boolean }>;
    };
  };
};

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isValidEventType(value: string) {
  return value === "failed_answer" || value === "timeout";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return Response.json(
        { ok: false, error: "invalid_body" },
        { status: 400 }
      );
    }

    const data = body as {
      playerName?: unknown;
      eventType?: unknown;
      question?: unknown;
      playerAnswer?: unknown;
      correctAnswer?: unknown;
    };

    const playerName = String(data.playerName ?? "").trim();
    const eventType = String(data.eventType ?? "").trim();
    const question = String(data.question ?? "").trim();
    const playerAnswer = String(data.playerAnswer ?? "").trim();
    const correctAnswer = String(data.correctAnswer ?? "").trim();

    if (!isValidEventType(eventType)) {
      return Response.json(
        { ok: false, error: "invalid_event_type" },
        { status: 400 }
      );
    }

    const { env } = getCloudflareContext();
    const db = (env as { schulte_focus_db?: D1DatabaseLike }).schulte_focus_db;

    if (!db) {
      return Response.json(
        { ok: false, error: "d1_binding_not_found" },
        { status: 500 }
      );
    }

    const reason =
      eventType === "timeout"
        ? "rest_guard_timeout"
        : "rest_guard_failed_answer";

    const riskScore = eventType === "timeout" ? 80 : 50;
    const nowIso = new Date().toISOString();
    const ip = getClientIp(request);

    await db
      .prepare(`
        INSERT INTO security_events (
          player_name,
          challenge_id,
          ip_address,
          user_agent,
          event_type,
          reason,
          risk_score,
          question,
          player_answer,
          correct_answer,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        playerName || null,
        null,
        ip,
        request.headers.get("user-agent") ?? "unknown",
        eventType,
        reason,
        riskScore,
        question || null,
        playerAnswer || null,
        correctAnswer || null,
        nowIso
      )
      .run();

    return Response.json({
      ok: true,
      logged: true,
      reason,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "rest_guard_event_failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}