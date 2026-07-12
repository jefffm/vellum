import { randomUUID } from "node:crypto";
import type { ArrangementPlan } from "../../lib/music-domain.js";
import { LineageService } from "./lineage-service.js";
import { WorkspaceStore } from "./workspace-store.js";

export type ArrangementPlanCorrection = Pick<
  ArrangementPlan,
  | "kind"
  | "planningScope"
  | "transpositionPlan"
  | "sectionalIntent"
  | "materialDisposition"
  | "specialistIntent"
  | "decisions"
  | "status"
>;

export class ArrangementPlanService {
  private readonly store: WorkspaceStore;
  private readonly lineage: LineageService;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: {
    store: WorkspaceStore;
    lineage?: LineageService;
    now?: () => Date;
    createId?: () => string;
  }) {
    this.store = options.store;
    this.lineage = options.lineage ?? new LineageService({ store: options.store });
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  correct(
    workspaceId: string,
    priorPlanId: string,
    correction: ArrangementPlanCorrection,
    reason: string
  ): { plan: ArrangementPlan; staleDerivationIds: string[] } {
    const prior = this.store.getArrangementPlan(workspaceId, priorPlanId);
    const plan = this.store.saveArrangementPlan(workspaceId, {
      ...prior,
      ...correction,
      id: `plan.${this.createId()}`,
      version: prior.version + 1,
      supersedesPlanId: prior.id,
      createdAt: this.now().toISOString(),
    });
    const stale = this.lineage.markPlanDependentsStale(workspaceId, prior.id, plan.id, reason);
    return { plan, staleDerivationIds: stale.map((record) => record.id) };
  }
}
