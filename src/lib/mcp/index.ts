import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClasses from "./tools/list-classes";
import listSessions from "./tools/list-sessions";
import myAttendance from "./tools/my-attendance";

// OAuth issuer MUST be the direct Supabase host (not the .lovable.cloud proxy).
// Read the project ref from the Vite-inlined env; fall back for manifest-extract eval.
const projectRef =
  (import.meta as { env?: { VITE_SUPABASE_PROJECT_ID?: string } }).env
    ?.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "facepresence-mcp",
  title: "FacePresence MCP",
  version: "0.1.0",
  instructions:
    "Tools for FacePresence: browse classes, sessions, and your own attendance records. All calls run as the signed-in user with row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listClasses, listSessions, myAttendance],
});
