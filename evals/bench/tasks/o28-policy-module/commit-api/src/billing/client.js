import { BillingUnavailable } from '../api/http.js';

/** Client for the billing service, which knows each organisation's plan. */
export function createBillingClient({ fetchPlan }) {
  return {
    async hasFeature(orgId, feature) {
      let plan;
      try {
        plan = await fetchPlan(orgId);
      } catch (err) {
        throw new BillingUnavailable(err);
      }
      return plan.features.includes(feature);
    },
  };
}
