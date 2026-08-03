# Security Policy

AgentPresent works with sensitive real-world context, including location and saved places. Security and privacy reports are taken seriously.

## Supported versions

AgentPresent is currently an early MVP. Security fixes will be applied to the latest version on the `main` branch.

## Reporting a vulnerability

Please do not publish sensitive vulnerability details in a public issue.

Contact the repository owner privately through GitHub with:

- A clear description of the issue
- Steps to reproduce it
- The possible impact
- A suggested fix, if available

## Security expectations for integrations

Applications and agents using AgentPresent should:

- Ask for explicit permission before accessing location
- Collect only the minimum location data needed
- Avoid storing raw location history by default
- Protect API keys and provider credentials
- Let users inspect and cancel active monitors
- Explain why a reminder or action was triggered
- Validate callback and webhook destinations
- Encrypt sensitive data in transit and at rest

## Scope

Examples of relevant reports include:

- Unauthorized access to location data
- Leaking saved places or coordinates
- Reminder events delivered to the wrong user
- Callback or webhook injection
- Provider-key exposure
- Monitor cancellation bypasses
- Unsafe persistence or logging defaults
