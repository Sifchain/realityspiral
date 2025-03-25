import { elizaLogger } from "@elizaos/core";
import * as Sentry from "@sentry/node";

export function initErrorTracking() {
	if (!process.env.SENTRY_DSN) {
		elizaLogger.warn("Sentry DSN not provided - error tracking disabled");
		return;
	}

	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.SENTRY_ENVIRONMENT || "development",
		release: process.env.SENTRY_RELEASE,
		tracesSampleRate: 1.0,
		integrations: [
			new Sentry.Integrations.Http({ tracing: true }),
			new Sentry.Integrations.Express(),
			new Sentry.Integrations.Postgres(),
		],
	});
}

export function captureError(error: Error, context?: Record<string, unknown>) {
	if (!process.env.SENTRY_DSN) {
		return;
	}

	Sentry.withScope((scope) => {
		if (context) {
			scope.setExtras(context);
		}
		Sentry.captureException(error);
	});
}
