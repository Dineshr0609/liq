import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface EditLockState {
  status: "idle" | "acquiring" | "held" | "locked" | "error";
  heldByMe: boolean;
  holderName?: string;
  holderId?: string;
  isStale?: boolean;
  acquiredAt?: string;
  lastHeartbeatAt?: string;
  error?: string;
}

interface AcquireResponse {
  locked?: boolean;
  heldByMe?: boolean;
  isStale?: boolean;
  userId?: string;
  userName?: string;
  acquiredAt?: string;
  lastHeartbeatAt?: string;
  tookOver?: boolean;
  error?: string;
}

const HEARTBEAT_MS = 30_000;

/**
 * Hook that acquires a single-editor lock for a contract while the user is on
 * the edit page. Heartbeats every 30s and releases the lock on unmount/page-hide.
 *
 * Returns the current lock state and a `takeOver()` function to forcibly steal
 * the lock from a stale or another user (logged on the server as a takeover).
 */
export function useContractEditLock(contractId: string | undefined): {
  state: EditLockState;
  takeOver: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<EditLockState>({
    status: "idle",
    heldByMe: false,
  });
  const heartbeatRef = useRef<number | null>(null);
  const releasedRef = useRef(false);

  const applyResponse = (resp: AcquireResponse, ok: boolean) => {
    if (ok && resp.heldByMe) {
      setState({
        status: "held",
        heldByMe: true,
        holderName: resp.userName,
        holderId: resp.userId,
        acquiredAt: resp.acquiredAt,
        lastHeartbeatAt: resp.lastHeartbeatAt,
      });
    } else {
      setState({
        status: "locked",
        heldByMe: false,
        holderName: resp.userName || "Another user",
        holderId: resp.userId,
        isStale: resp.isStale,
        acquiredAt: resp.acquiredAt,
        lastHeartbeatAt: resp.lastHeartbeatAt,
        error: resp.error,
      });
    }
  };

  const acquire = async (force: boolean) => {
    if (!contractId) return;
    setState((s) => ({ ...s, status: "acquiring" }));
    try {
      const res = await apiRequest(
        "POST",
        `/api/contracts/${contractId}/edit-lock/acquire`,
        { force },
      );
      const data: AcquireResponse = await res.json().catch(() => ({}));
      applyResponse(data, res.ok);
    } catch (err: any) {
      // apiRequest throws on non-2xx — try to parse the body from the message.
      const msg = String(err?.message || "");
      const jsonMatch = msg.match(/\{.*\}$/);
      let parsed: AcquireResponse = {};
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
      }
      if (parsed && (parsed.userId || parsed.userName)) {
        applyResponse(parsed, false);
      } else {
        setState({ status: "error", heldByMe: false, error: msg || "Failed to acquire lock" });
      }
    }
  };

  const heartbeat = async () => {
    if (!contractId || releasedRef.current) return;
    try {
      const res = await apiRequest(
        "POST",
        `/api/contracts/${contractId}/edit-lock/heartbeat`,
        {},
      );
      if (!res.ok) {
        const data: AcquireResponse = await res.json().catch(() => ({}));
        applyResponse(data, false);
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      const jsonMatch = msg.match(/\{.*\}$/);
      if (jsonMatch) {
        try {
          const parsed: AcquireResponse = JSON.parse(jsonMatch[0]);
          applyResponse(parsed, false);
        } catch { /* noop */ }
      }
    }
  };

  // Acquire on mount, heartbeat on interval, release on unmount.
  useEffect(() => {
    if (!contractId) return;
    releasedRef.current = false;
    acquire(false);
    heartbeatRef.current = window.setInterval(heartbeat, HEARTBEAT_MS);

    const release = () => {
      if (releasedRef.current) return;
      releasedRef.current = true;
      // Use sendBeacon-style fire-and-forget; the user is leaving.
      try {
        navigator.sendBeacon?.(
          `/api/contracts/${contractId}/edit-lock/release`,
          new Blob(["{}"], { type: "application/json" }),
        );
      } catch { /* noop */ }
      // Also fire a regular request as a fallback (sendBeacon may be blocked
      // on logged-in cookie sessions in some browsers).
      void apiRequest("POST", `/api/contracts/${contractId}/edit-lock/release`, {})
        .catch(() => undefined);
    };

    window.addEventListener("beforeunload", release);
    window.addEventListener("pagehide", release);

    return () => {
      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      window.removeEventListener("beforeunload", release);
      window.removeEventListener("pagehide", release);
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  return {
    state,
    takeOver: () => acquire(true),
    refresh: () => acquire(false),
  };
}
