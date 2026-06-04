import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type ModeKey = "standard" | "reverse";

type ChallengeRow = {
  id: string;
  player_name: string;
  mode: ModeKey;
  difficulty: string;
  expires_at: string;
  used_at: string | null;
};

type ExistingScoreRow = {
  best_time: number;
};

type CountRow = {
  count: number;
};

type CutoffRow = {
  best_time: number;
};

type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success: boolean; meta?: { changes?: number } }>;
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
    };
  };
};

type ClickItem = {
  number?: unknown;
  expected?: unknown;
  correct?: boolean;
  timestamp?: unknown;
};

function isValidMode(mode: string): mode is ModeKey {
  return mode === "standard" || mode === "reverse";
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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
      enteredTop50: false,
      top50Cutoff: null,
      secondsBehindTop50: null,
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
      challengeId?: unknown;
      clientCompleteTime?: unknown;
      errors?: unknown;
      clickHistory?: unknown;
    };

    const playerName = String(data.playerName ?? "").trim();
    const mode = String(data.mode ?? "").trim();
    const difficulty = "hard";
    const challengeId = String(data.challengeId ?? "").trim();
    const clientCompleteTime = Number(data.clientCompleteTime);
    const errors = Number(data.errors ?? 0);
    const clickHistory = Array.isArray(data.clickHistory)
      ? (data.clickHistory as ClickItem[])
      : [];

    if (!/^[A-Z]{1,8}#[0-9]{6}$/.test(playerName)) {
      return reject("invalid_player_name");
    }

    if (!isValidMode(mode)) {
      return reject("invalid_mode");
    }

    if (!isValidUuid(challengeId)) {
      return reject("invalid_challenge");
    }

    if (!Number.isFinite(clientCompleteTime)) {
      return reject("invalid_client_time");
    }

    if (clientCompleteTime <= 0 || clientCompleteTime > 6) {
      return reject("not_rank_submit_range");
    }

    if (!Number.isInteger(errors) || errors < 0 || errors > 999) {
      return reject("invalid_errors");
    }

    if (errors >= 10) {
      return reject("too_many_errors");
    }

    const { env } = getCloudflareContext();
    const db = (env as { schulte_focus_db?: D1DatabaseLike }).schulte_focus_db;

    if (!db) {
      return reject("d1_binding_not_found", 500);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const ip = getClientIp(request);

    const challenge = await db
      .prepare(`
        SELECT id, player_name, mode, difficulty, expires_at, used_at
        FROM score_challenges
        WHERE id = ?
        LIMIT 1
      `)
      .bind(challengeId)
      .first<ChallengeRow>();

    if (!challenge) return reject("challenge_not_found");
    if (challenge.player_name !== playerName) return reject("challenge_player_mismatch");
    if (challenge.mode !== mode) return reject("challenge_mode_mismatch");
    if (challenge.difficulty !== difficulty) return reject("challenge_difficulty_mismatch");
    if (challenge.used_at) return reject("challenge_already_used");

    const expiresAt = new Date(challenge.expires_at);
    if (Number.isNaN(expiresAt.getTime())) return reject("invalid_challenge_expiry");
    if (expiresAt.getTime() < now.getTime()) return reject("challenge_expired");

    const safeTime = Number(clientCompleteTime.toFixed(5));

    const correctClicks = clickHistory.filter((item) => item.correct === true);
    if (correctClicks.length !== 25) return reject("invalid_click_history");

    const expectedSequence =
      mode === "reverse"
        ? Array.from({ length: 25 }, (_, index) => 25 - index)
        : Array.from({ length: 25 }, (_, index) => index + 1);

    for (let index = 0; index < 25; index += 1) {
      const item = correctClicks[index];
      const expected = expectedSequence[index];

      if (Number(item.number) !== expected) return reject("invalid_sequence");
      if (Number(item.expected) !== expected) return reject("invalid_expected");
      if (item.correct !== true) return reject("invalid_correct");
    }

    await db
      .prepare(`
        UPDATE score_challenges
        SET used_at = ?,
            completed_at = ?,
            complete_time = ?,
            errors = ?,
            submit_ip_address = ?,
            submit_user_agent = ?,
            click_history = ?
        WHERE id = ?
          AND used_at IS NULL
      `)
      .bind(
        nowIso,
        nowIso,
        safeTime,
        errors,
        ip,
        request.headers.get("user-agent") ?? "unknown",
        JSON.stringify(clickHistory),
        challengeId
      )
      .run();

    const existing = await db
      .prepare(`
        SELECT best_time
        FROM leaderboard_entries
        WHERE player_name = ?
          AND mode = ?
        LIMIT 1
      `)
      .bind(playerName, mode)
      .first<ExistingScoreRow>();

    if (existing && Number(existing.best_time) <= safeTime) {
      return Response.json(
        {
          accepted: true,
          enteredTop50: null,
          top50Cutoff: null,
          secondsBehindTop50: null,
          rejectedReason: "not_better_than_existing",
          playerName,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (existing) {
      await db
        .prepare(`
          UPDATE leaderboard_entries
          SET best_time = ?,
              errors = ?,
              updated_at = ?
          WHERE player_name = ?
            AND mode = ?
        `)
        .bind(safeTime, errors, nowIso, playerName, mode)
        .run();
    } else {
      await db
        .prepare(`
          INSERT INTO leaderboard_entries (
            player_name,
            mode,
            best_time,
            errors,
            achieved_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(playerName, mode, safeTime, errors, nowIso, nowIso)
        .run();
    }

    const better = await db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM leaderboard_entries
        WHERE mode = ?
          AND best_time < ?
      `)
      .bind(mode, safeTime)
      .first<CountRow>();

    const total = await db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM leaderboard_entries
        WHERE mode = ?
      `)
      .bind(mode)
      .first<CountRow>();

    const cutoff = await db
      .prepare(`
        SELECT best_time
        FROM leaderboard_entries
        WHERE mode = ?
        ORDER BY best_time ASC
        LIMIT 1 OFFSET 49
      `)
      .bind(mode)
      .first<CutoffRow>();

    const rank = Number(better?.count ?? 0) + 1;
    const totalPlayers = Math.max(Number(total?.count ?? 0), 1);
    const beatPercent = Math.max(
      0,
      Math.min(99, Math.floor(((totalPlayers - rank) / totalPlayers) * 100))
    );

    const top50Cutoff = cutoff?.best_time ? Number(cutoff.best_time) : null;
    const enteredTop50 = rank <= 50;

    return Response.json(
      {
        accepted: true,
        enteredTop50,
        top50Cutoff,
        secondsBehindTop50:
          top50Cutoff !== null && !enteredTop50
            ? Number((safeTime - top50Cutoff).toFixed(5))
            : null,
        rejectedReason: null,
        playerName,
        rank,
        beatPercent,
        totalPlayers,
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
        enteredTop50: false,
        top50Cutoff: null,
        secondsBehindTop50: null,
        rejectedReason: "submit_failed",
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