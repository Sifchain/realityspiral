  ### Error Tracking
  
  The system uses Sentry for error tracking. To enable it:
  
  1. Set up a Sentry account and get your DSN from the Sentry dashboard
  2. Add the following to your .env file:
  ```
  SENTRY_DSN=your-dsn-here
  SENTRY_ENVIRONMENT=development
  SENTRY_ENABLED=true
  ``` 