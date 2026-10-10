import { fetch } from "undici";
import { moodleAgent } from "@/lib/moodle-tls";

const INSTANCES = {
  moodle: "https://moodle.iitd.ac.in",
  moodlenew: "https://moodlenew.iitd.ac.in",
};

// Proves the deployment can reach IITD Moodle (with full TLS verification).
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await Promise.all(
    Object.entries(INSTANCES).map(async ([instance, base]) => {
      const started = Date.now();
      try {
        const res = await fetch(`${base}/lib/ajax/service-nologin.php?info=tool_mobile_get_public_config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{ index: 0, methodname: "tool_mobile_get_public_config", args: {} }]),
          dispatcher: moodleAgent,
          signal: AbortSignal.timeout(10_000),
        });
        const [first] = (await res.json()) as [{ error: boolean; data?: { sitename: string } }];
        return { instance, ok: !first.error, sitename: first.data?.sitename, ms: Date.now() - started };
      } catch (err) {
        // undici hides the real reason (DNS, TCP reset, TLS…) in `cause`.
        const cause = (err as { cause?: { code?: string; message?: string } }).cause;
        return { instance, ok: false, error: String(err), cause: cause?.code ?? cause?.message, ms: Date.now() - started };
      }
    }),
  );
  return Response.json({ region: process.env.VERCEL_REGION ?? "local", results });
}
