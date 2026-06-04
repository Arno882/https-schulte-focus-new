export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    step: "route_alive",
    time: new Date().toISOString(),
  });
}