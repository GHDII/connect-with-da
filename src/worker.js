/**
 * Connect with DA — Cloudflare Worker
 *
 * Serves static assets from Workers Sites (KV) and proxies
 * Cal.com API requests at /api/slots, keeping the API key server-side.
 */

import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

const assetManifest = JSON.parse(manifestJSON);

/* Allowed Cal.com event type IDs — prevents enumeration of other events */
const ALLOWED_EVENT_TYPES = new Set(["454747", "454745"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* ─── API Routes ─── */
    if (url.pathname === "/api/slots") {
      if (request.method === "OPTIONS") {
        return handleCORS();
      }
      if (request.method === "GET") {
        return handleSlots(url, env);
      }
      return new Response("Method Not Allowed", { status: 405 });
    }

    /* ─── Static Assets ─── */
    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      // If asset not found, serve index.html (SPA fallback)
      try {
        const notFoundRequest = new Request(
          new URL("/index.html", request.url).toString(),
          request
        );
        return await getAssetFromKV(
          { request: notFoundRequest, waitUntil: ctx.waitUntil.bind(ctx) },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          }
        );
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    }
  },
};

/* ─── Cal.com Slots Proxy ─── */
async function handleSlots(url, env) {
  const eventTypeId = url.searchParams.get("eventTypeId");
  const startTime = url.searchParams.get("startTime");
  const endTime = url.searchParams.get("endTime");
  const duration = url.searchParams.get("duration");

  if (!eventTypeId || !startTime || !endTime) {
    return jsonResponse(
      { status: "error", message: "Missing required parameters: eventTypeId, startTime, endTime" },
      400,
      false
    );
  }

  if (!ALLOWED_EVENT_TYPES.has(eventTypeId)) {
    return jsonResponse(
      { status: "error", message: "Invalid event type" },
      403,
      false
    );
  }

  /* Validate ISO 8601 date format and reasonable range */
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  if (!isoPattern.test(startTime) || !isoPattern.test(endTime)) {
    return jsonResponse(
      { status: "error", message: "Invalid date format — ISO 8601 required" },
      400,
      false
    );
  }
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return jsonResponse(
      { status: "error", message: "Invalid date values" },
      400,
      false
    );
  }
  if (endDate - startDate > 90 * 24 * 60 * 60 * 1000) {
    return jsonResponse(
      { status: "error", message: "Date range exceeds 90-day maximum" },
      400,
      false
    );
  }

  const apiKey = env.CAL_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { status: "error", message: "CAL_API_KEY not configured" },
      500,
      false
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
        "cal-api-version": "2024-08-13",
      },
    });

    const data = await calRes.json();
    return jsonResponse(data, calRes.status, calRes.ok);
  } catch {
    return jsonResponse(
      { status: "error", message: "Failed to reach Cal.com API" },
      502,
      false
    );
  }
}

/* ─── Helpers ─── */
function jsonResponse(data, status = 200, cache = true) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(cache),
  });
}

function handleCORS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders(cache = true) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  headers["Cache-Control"] = cache ? "public, max-age=60" : "no-store";
  return headers;
}
