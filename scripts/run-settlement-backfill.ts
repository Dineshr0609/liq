import { backfillAutoAttachSettlements } from "../server/services/claimSettlementMatcher";
(async () => {
  const r = await backfillAutoAttachSettlements();
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
})();
