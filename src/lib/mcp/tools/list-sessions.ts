import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_sessions",
  title: "List sessions",
  description: "List course sessions visible to the signed-in user. Optionally filter by status.",
  inputSchema: {
    status: z
      .enum(["scheduled", "live", "ended", "cancelled"])
      .optional()
      .describe("Optional session status filter."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("sessions")
      .select("id, title, scheduled_start, scheduled_end, status, zoom_join_url, class_id")
      .order("scheduled_start", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { sessions: data },
    };
  },
});
