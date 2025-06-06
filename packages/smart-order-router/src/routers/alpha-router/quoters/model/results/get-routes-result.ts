import type { SupportedRoutes } from "../../../../router";
import type { CandidatePoolsBySelectionCriteria } from "../../../functions/get-candidate-pools";

export interface GetRoutesResult<Route extends SupportedRoutes> {
	routes: Route[];
	candidatePools: CandidatePoolsBySelectionCriteria;
}
