declare module '@opentelemetry/resources' {
  export class Resource {
    constructor(attributes?: Record<string, any>);
    static default(): Resource;
    static empty(): Resource;
    static create(attributes: Record<string, any>): Resource;
    merge(other: Resource): Resource;
    getAttributes(): Record<string, any>;
  }
}

declare module '@opentelemetry/semantic-conventions' {
  export const SemanticResourceAttributes: Record<string, string>;
} 