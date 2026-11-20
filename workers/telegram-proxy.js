/**
 * ============================================================================
 * OPTIONAL: FREE TELEGRAM UNLIMITED MEDIA PROXY (Cloudflare Worker)
 * ============================================================================
 * Use this ONLY if you want to host unlimited images/videos in a private
 * Telegram channel (free lifetime storage) without exposing your Bot Token!
 *
 * Setup (100% Free Cloudflare Workers Tier - 100,000 requests/day):
 * 1. Create a Telegram Bot via @BotFather -> get BOT_TOKEN
 * 2. Create a private Telegram channel -> add the bot as Admin
 * 3. In Cloudflare Dashboard -> Workers & Pages -> Create Worker -> paste code
 * 4. Go to Worker Settings -> Variables & Secrets -> Add Secret:
 *    Name: TG_BOT_TOKEN   Value: <your bot token>
 * 5. Access files via: https://<your-worker>.workers.dev/file/<telegram_file_id>
 * ============================================================================
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/file\/([^/]+)$/);
    if (!match) {
      return new Response("Telegram Portfolio Media Proxy Ready", { status: 200 });
    }

    const fileId = decodeURIComponent(match[1]);
    const metaRes = await fetch(
      `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    const meta = await metaRes.json();
    if (!meta.ok || !meta.result || !meta.result.file_path) {
      return new Response("File not found", { status: 404 });
    }

    const fileUrl = `https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${meta.result.file_path}`;
    const mediaRes = await fetch(fileUrl);

    const headers = new Headers(mediaRes.headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.delete("Content-Disposition"); // render inline instead of forcing download

    return new Response(mediaRes.body, {
      status: mediaRes.status,
      headers
    });
  }
};
