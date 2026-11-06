import { currentUser, error, sameOrigin } from "../../lib/util.js";

// Pour toute l'API : session chargée dans context.data.user, origine vérifiée sur les écritures.
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !sameOrigin(request, env)) {
    return error(403, "Request refused: unknown origin.");
  }
  try {
    context.data.user = await currentUser(env, request);
  } catch (e) {
    return error(500, "Database unavailable, try again in a moment.");
  }
  const res = await context.next();
  const out = new Response(res.body, res);
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("cache-control", "no-store");
  return out;
}
