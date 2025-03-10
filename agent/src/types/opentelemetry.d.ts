declare module "@opentelemetry/resources" {
	export class Resource {
		constructor(attributes?: Record<string, unknown>);
		static default(): Resource;
		static empty(): Resource;
		static create(attributes: Record<string, unknown>): Resource;
		merge(other: Resource): Resource;
		getAttributes(): Record<string, unknown>;
	}
}

declare module "@opentelemetry/semantic-conventions" {
	export const SemanticResourceAttributes: Record<string, string>;
}
