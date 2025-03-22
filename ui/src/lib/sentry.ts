import * as Sentry from "@sentry/browser";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT;
const SENTRY_ENABLED = import.meta.env.VITE_SENTRY_ENABLED === "true";

export function initUISentry() {
	if (!SENTRY_DSN) {
		console.warn("Sentry DSN not provided - UI error tracking disabled");
		return;
	}

	Sentry.init({
		dsn: SENTRY_DSN,
		tracesSampleRate: 1.0,
		environment: SENTRY_ENVIRONMENT,
		enabled: SENTRY_ENABLED,
		// Adjust this value in production
		replaysSessionSampleRate: 0.1,
		// If you're not using session replay, you can remove this option
		replaysOnErrorSampleRate: 1.0,
	});
	captureUIError(new Error("Test error 45"));
}

export function captureUIError(
	error: Error,
	context?: Record<string, unknown>,
) {
	if (!SENTRY_DSN || !SENTRY_ENABLED) {
		return;
	}

	Sentry.withScope((scope) => {
		if (context) {
			scope.setExtras(context);
		}
		Sentry.captureException(error);
	});
}
