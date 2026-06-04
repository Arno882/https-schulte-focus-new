import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success: boolean }>;
    };
  };
};

function isValidMode(mode: string) {
  return mode === "standard" || mode === "reverse";
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function reject(reason: string, status = 400) {
  return Response.json(
    {
      accepted: false,
      rejectedReason: reason,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return reject("invalid_body");
    }

    const data = body as {
      playerName?: unknown;
      mode?: unknown;
      difficulty?: unknown;
    };

    const playerName = String(data.playerName ?? "").trim();
    const mode = String(data.mode ?? "").trim();
    const difficulty = "hard";

    if (!/^[A-Z]{1,8}#[0-9]{6}$/.test(playerName)) {
      return reject("invalid_player_name");
    }

    if (!isValidMode(mode)) {
      return reject("invalid_mode");
    }

    const { env } = getCloudflareContext();
    const db = (env as { schulte_focus_db?: D1DatabaseLike }).schulte_focus_db;

    if (!db) {
      return reject("d1_binding_not_found", 500);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const challengeId = crypto.randomUUID();
    const boardSeed = Math.floor(Math.random() * 1000000000000);
    const ip = getClientIp(request);

    await db
      .prepare(`
        INSERT INTO score_challenges (
          id,
          player_name,
          mode,
          difficulty,
          board_seed,
          started_at,
          expires_at,
          ip_address,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        challengeId,
        playerName,
        mode,
        difficulty,
        boardSeed,
        now.toISOString(),
        expiresAt.toISOString(),
        ip,
        request.headers.get("user-agent") ?? "unknown"
      )
      .run();

    return Response.json(
      {
        accepted: true,
        challengeId,
        boardSeed,
        expiresAt: expiresAt.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return Response.json(
      {
        accepted: false,
        rejectedReason: "challenge_start_failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}