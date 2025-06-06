import type { RouteWithValidQuote } from "../../../entities";
import type { CandidatePoolsBySelectionCriteria } from "../../../functions/get-candidate-pools";

export interface GetQuotesResult {
	routesWithValidQuotes: RouteWithValidQuote[];
	candidatePools?: CandidatePoolsBySelectionCriteria;
}
