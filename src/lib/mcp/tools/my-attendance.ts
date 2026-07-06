import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_attendance",
  title: "My attendance",
  description: "Return the signed-in user's attendance records across sessions.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("attendances")
      .select("id, session_id, status, joined_at, left_at, verification_method, confidence_score")
      .eq("student_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { attendance: data },
    };
  },
});
