import { URISubgraphProvider } from "../uri-subgraph-provider";

import type { IV2SubgraphProvider, V2SubgraphPool } from "./subgraph-provider";

export class V2URISubgraphProvider
	extends URISubgraphProvider<V2SubgraphPool>
	implements IV2SubgraphProvider {}
