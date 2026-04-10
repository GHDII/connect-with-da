/**
 * Cloudflare Pages Function — Cal.com Slots Proxy
 *
 * Proxies requests to the Cal.com v2 API for available time slots,
 * keeping the API key server-side (set as CAL_API_KEY env var in
 * the Cloudflare Pages dashboard).
 *
 * GET /api/slots?eventTypeId=...&startTime=...&endTime=...&duration=...
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const eventTypeId = url.searchParams.get("eventTypeId");
  const startTime = url.searchParams.get("startTime");
  const endTime = url.searchParams.get("endTime");
  const duration = url.searchParams.get("duration");

  if (!eventTypeId || !startTime || !endTime) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Missing required parameters: eventTypeId, startTime, endTime",
      }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const apiKey = env.CAL_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "CAL_API_KEY not configured",
      }),
      { status: 500, headers: corsHeaders() }
    );
  }

  const calUrl = new URL("https://api.cal.com/v2/slots/available");
  calUrl.searchParams.set("eventTypeId", eventTypeId);
  calUrl.searchParams.set("startTime", startTime);
  calUrl.searchParams.set("endTime", endTime);
  if (duration) {
    calUrl.searchParams.set("duration", duration);
  }

  try {
    const calRes = await fetch(calUrl.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
      },
    });

    const data = await calRes.json();

    return new Response(JSON.stringify(data), {
      status: calRes.status,
      headers: corsHeaders(),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ status: "error", message: "Failed to reach Cal.com API" }),
      { status: 502, headers: corsHeaders() }
    );
  }
}

/** Handle CORS preflight */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60",
  };
}
