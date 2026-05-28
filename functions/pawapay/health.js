import { CORS_HEADERS } from "../../_helpers";

export async function onRequestGet(context) {
  const CORS = CORS_HEADERS(context.env);
  return new Response(
    JSON.stringify({ status: "ok", service: "sdsprotech" }),
    { headers: CORS }
  );
}
