import { storage, type OrgAccessContext } from "../storage";

/**
 * Single source of truth for "can this user see / mutate this contract?".
 *
 * Mirrors the multi-tenant scoping that the parent /api/contracts/:id route
 * already enforces:
 *   - true system admins bypass org-context filtering
 *   - everyone else must have an active companyId in context
 *   - non-admin context roles can only access contracts they uploaded
 *
 * Returns 403 (Access denied) for ANY failure mode — including missing
 * contracts — so we never leak existence via a 404. Callers should map
 * `authorized=false` to res.status(403).
 *
 * Callers that need to distinguish "missing" vs "forbidden" can look at
 * `contract === undefined` AFTER they've already passed the authorized
 * check; we deliberately do not surface the distinction at this layer.
 */
export async function validateContractAccess(
  contractId: string,
  user: any,
): Promise<{ contract: any; authorized: boolean; error?: string }> {
  if (!user) {
    return { contract: undefined, authorized: false, error: "Access denied" };
  }
  const userId = user.id;
  const userIsSystemAdmin = user.isSystemAdmin === true;

  if (userIsSystemAdmin) {
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return { contract: undefined, authorized: false, error: "Access denied" };
    }
    return { contract, authorized: true };
  }

  const activeContext = user.activeContext;
  if (!activeContext || !activeContext.companyId) {
    return { contract: undefined, authorized: false, error: "Access denied" };
  }

  const contextRole = activeContext.role;
  const hasContextAdminAccess =
    contextRole === "admin" ||
    contextRole === "owner" ||
    contextRole === "company_admin";

  const orgContext: OrgAccessContext = {
    activeContext: hasContextAdminAccess
      ? activeContext
      : { ...activeContext, role: "user" },
    globalRole: hasContextAdminAccess ? contextRole : "viewer",
    userId,
    isSystemAdmin: false,
  };

  const contract = await storage.getContract(contractId, orgContext);
  if (!contract) {
    return { contract: undefined, authorized: false, error: "Access denied" };
  }

  if (!hasContextAdminAccess && contract.uploadedBy !== userId) {
    return { contract, authorized: false, error: "Access denied" };
  }

  return { contract, authorized: true };
}
