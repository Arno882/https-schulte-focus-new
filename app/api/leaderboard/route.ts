import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type LeaderboardRow = {
  player_name: string;
  mode: "standard" | "reverse";
  best_time: number;
  errors: number;
  achieved_at: string;
  updated_at: string;
};

type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: <T = unknown>() => Promise<{ results?: T[] }>;
    };
  };
};

function isValidMode(mode: string) {
  return mode === "standard" || mode === "reverse";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    if (!mode || !isValidMode(mode)) {
      return Response.json(
        { error: "Invalid mode" },
        { status: 400 }
      );
    }

    const { env } = getCloudflareContext();
    const db = (env as { schulte_focus_db?: D1DatabaseLike })
      .schulte_focus_db;

    if (!db) {
      return Response.json(
        { error: "D1 binding not found" },
        { status: 500 }
      );
    }

    const result = await db
      .prepare(`
        SELECT player_name, mode, best_time, errors, achieved_at, updated_at
        FROM leaderboard_entries
        WHERE mode = ?
        ORDER BY best_time ASC, updated_at ASC
        LIMIT 100
      `)
      .bind(mode)
      .all<LeaderboardRow>();

    const entries = (result.results ?? []).map((item, index) => ({
      rank: index + 1,
      playerName: item.player_name,
      mode: item.mode,
      time: Number(item.best_time),
      errors: Number(item.errors ?? 0),
      achievedAt: item.achieved_at,
      updatedAt: item.updated_at,
    }));

    return Response.json(
      {
        mode,
        totalPlayers: entries.length,
        entries,
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
        error: "Failed to load leaderboard",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
