import * as React from "react";
import { acquireLock, releaseLock, type AcquireLockResult, type LockResource } from "@/lib/firestore/locks";
import { getCurrentUserIdentity } from "@/lib/auth/currentUser";

export function useDocLock(input: {
  resource: LockResource;
  resourceId: string | null;
  enabled?: boolean;
  leaseMs?: number;
}) {
  const enabled = input.enabled ?? true;
  const leaseMs = input.leaseMs ?? 2 * 60 * 1000;
  const [state, setState] = React.useState<AcquireLockResult | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    const rid = input.resourceId;
    if (!rid) {
      setState(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const me = getCurrentUserIdentity();
      if (!me) return;
      const res = await acquireLock({
        resource: input.resource,
        resourceId: rid,
        ownerUid: me.uid,
        ownerName: me.name,
        leaseMs,
      });
      if (cancelled) return;
      setState(res);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, input.resource, input.resourceId]);

  React.useEffect(() => {
    if (!enabled) return;
    if (!input.resourceId) return;
    const me = getCurrentUserIdentity();
    if (!me) return;
    if (!state?.ok) return;
    const t = window.setInterval(() => {
      void acquireLock({
        resource: input.resource,
        resourceId: input.resourceId!,
        ownerUid: me.uid,
        ownerName: me.name,
        leaseMs,
      }).then((res) => setState(res));
    }, 60_000);
    return () => window.clearInterval(t);
  }, [enabled, input.resource, input.resourceId, leaseMs, state]);

  React.useEffect(() => {
    return () => {
      if (!enabled) return;
      if (!input.resourceId) return;
      const me = getCurrentUserIdentity();
      if (!me) return;
      if (!state?.ok) return;
      void releaseLock({ resource: input.resource, resourceId: input.resourceId, ownerUid: me.uid });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, input.resource, input.resourceId]);

  const lockedByName = !state || state.ok ? null : state.lock.ownerName;
  const isReady = Boolean(state);
  const canEdit = !state ? false : state.ok;

  return { state, isReady, canEdit, lockedByName };
}

