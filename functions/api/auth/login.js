import { STATE_COOKIE, cookie, randomToken } from "../../../lib/util.js";

// Redirige vers Discord (scope identify : pseudo et avatar seulement).
export async function onRequestGet({ env, request }) {
  if (!env.DISCORD_CLIENT_ID || env.DISCORD_CLIENT_ID === "A_RENSEIGNER") {
    return new Response(null, { status: 302, headers: { location: "/app/#/error/" + encodeURIComponent("Discord sign-in is not set up yet. You can use trial mode.") } });
  }
  const origin = env.APP_ORIGIN || new URL(request.url).origin;
  const state = randomToken(24);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "none");
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), "set-cookie": cookie(STATE_COOKIE, state, { maxAge: 600, path: "/api/auth" }) },
  });
}
