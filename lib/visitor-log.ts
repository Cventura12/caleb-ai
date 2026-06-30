import { isDbConfigured, getDb } from "./db";

const MAX_FIRST_MSG = 500;

export async function logVisitor(
  sessionId: string,
  gateAnswer: string | null,
  firstMessage: string
): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    const db = getDb();
    await db.from("visitor_log").upsert(
      {
        session_id: sessionId,
        gate_answer: gateAnswer ? gateAnswer.slice(0, 200) : null,
        first_message: firstMessage.slice(0, MAX_FIRST_MSG),
      },
      { onConflict: "session_id", ignoreDuplicates: true }
    );
  } catch (err) {
    console.warn("[visitor-log] logVisitor failed:", err);
  }
}

export async function updateVisitorAction(
  sessionId: string,
  action: "booked" | "messaged"
): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    const db = getDb();
    await db
      .from("visitor_log")
      .update({ action })
      .eq("session_id", sessionId)
      .is("action", null); // only set once — first action wins
  } catch (err) {
    console.warn("[visitor-log] updateVisitorAction failed:", err);
  }
}

export async function listRecentVisitors(limit = 50) {
  if (!isDbConfigured()) return [];
  try {
    const db = getDb();
    const { data, error } = await db
      .from("visitor_log")
      .select("id,created_at,session_id,gate_answer,first_message,action")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.warn("[visitor-log] listRecentVisitors failed:", err);
    return [];
  }
}
