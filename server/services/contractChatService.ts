/**
 * Contract Chat Threads — Phase E of the agent-runtime roadmap.
 *
 * Persists agent conversations from the contracts page so reloads don't
 * drop history. Mirrors the close_chat_threads + close_chat_messages
 * pattern used by the period-close domain.
 *
 * Scope decisions:
 *   - Threads are private to the userId (enforced in the route layer).
 *   - companyId is recorded for audit/scoping but NOT used for cross-user
 *     visibility — two users in the same org never see each other's chats.
 *   - We don't persist tool-call internals (only the final answer payload)
 *     because the UI reconstructs everything from the FormattedAnswer
 *     content blob.
 */

import { db } from "../db";
import {
  contractChatThreads,
  contractChatMessages,
  type ContractChatThread,
  type ContractChatMessage,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";

const TITLE_MAX = 80;

function deriveTitle(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  return cleaned.length <= TITLE_MAX
    ? cleaned
    : cleaned.slice(0, TITLE_MAX - 1) + "…";
}

/** Create a new thread. Title is "New conversation" until the first turn. */
export async function createThread(
  userId: string,
  companyId: string | null,
): Promise<ContractChatThread> {
  const [row] = await (db.insert(contractChatThreads) as any)
    .values({ userId, companyId })
    .returning();
  return row;
}

/** List the user's active threads, newest activity first. */
export async function listThreads(userId: string): Promise<
  Array<Pick<ContractChatThread, "id" | "title" | "lastMessageAt" | "createdAt" | "status">>
> {
  const rows = await db
    .select({
      id: contractChatThreads.id,
      title: contractChatThreads.title,
      lastMessageAt: contractChatThreads.lastMessageAt,
      createdAt: contractChatThreads.createdAt,
      status: contractChatThreads.status,
    })
    .from(contractChatThreads)
    .where(and(eq(contractChatThreads.userId, userId), eq(contractChatThreads.status, "active")))
    .orderBy(desc(contractChatThreads.lastMessageAt))
    .limit(20);
  return rows;
}

/** Fetch a thread + its messages, but only if the caller owns it. */
export async function getThreadWithMessages(
  threadId: string,
  userId: string,
): Promise<{ thread: ContractChatThread; messages: ContractChatMessage[] } | null> {
  const [thread] = await db
    .select()
    .from(contractChatThreads)
    .where(and(eq(contractChatThreads.id, threadId), eq(contractChatThreads.userId, userId)))
    .limit(1);
  if (!thread) return null;
  const messages = await db
    .select()
    .from(contractChatMessages)
    .where(eq(contractChatMessages.threadId, threadId))
    .orderBy(contractChatMessages.createdAt);
  return { thread, messages };
}

/** Append one message; does not touch the thread row. Used in pairs (user/assistant). */
export async function appendMessage(
  threadId: string,
  role: "user" | "assistant" | "error",
  content: any,
): Promise<ContractChatMessage> {
  const [row] = await (db.insert(contractChatMessages) as any)
    .values({ threadId, role, content })
    .returning();
  return row;
}

/**
 * Bump lastMessageAt and (if still placeholder) auto-derive a title from
 * the first user prompt. Called once per turn after both messages have
 * been persisted.
 */
export async function touchThreadAfterTurn(
  threadId: string,
  firstPrompt: string | null,
): Promise<void> {
  const update: Record<string, any> = { lastMessageAt: new Date() };
  if (firstPrompt) {
    // Only overwrite the placeholder; never clobber a renamed title.
    const [existing] = await db
      .select({ title: contractChatThreads.title })
      .from(contractChatThreads)
      .where(eq(contractChatThreads.id, threadId))
      .limit(1);
    if (existing && existing.title === "New conversation") {
      update.title = deriveTitle(firstPrompt);
    }
  }
  await (db.update(contractChatThreads) as any)
    .set(update)
    .where(eq(contractChatThreads.id, threadId));
}

/** Rename or archive. Returns the updated row, or null if not owned. */
export async function patchThread(
  threadId: string,
  userId: string,
  patch: { title?: string; status?: "active" | "archived" },
): Promise<ContractChatThread | null> {
  const update: Record<string, any> = {};
  if (typeof patch.title === "string" && patch.title.trim()) {
    update.title = patch.title.trim().slice(0, TITLE_MAX);
  }
  if (patch.status === "active" || patch.status === "archived") {
    update.status = patch.status;
  }
  if (Object.keys(update).length === 0) {
    // Nothing to update — return the current row (still owner-scoped).
    const [row] = await db
      .select()
      .from(contractChatThreads)
      .where(and(eq(contractChatThreads.id, threadId), eq(contractChatThreads.userId, userId)))
      .limit(1);
    return row || null;
  }
  const [row] = await (db.update(contractChatThreads) as any)
    .set(update)
    .where(and(eq(contractChatThreads.id, threadId), eq(contractChatThreads.userId, userId)))
    .returning();
  return row || null;
}

/**
 * Build the conversationHistory array the askAgent service expects, from the
 * persisted message rows. Last 8 turns, both roles, content truncated.
 */
export function buildConversationHistory(messages: ContractChatMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  const recent = messages.slice(-8);
  return recent
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const text = (m.content as any)?.text ?? "";
      return {
        role: m.role as "user" | "assistant",
        content: text.length > 2000 ? text.slice(0, 2000) + "…" : text,
      };
    });
}
