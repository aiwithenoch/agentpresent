# Contributing to AgentPresent

Thanks for helping build open-source real-world context infrastructure for AI agents.

## Good first contributions

- Add or improve tests
- Improve documentation and examples
- Build a routing-provider adapter
- Build a location-provider adapter
- Improve scheduling strategies
- Add persistence support
- Improve privacy and security controls

## Development setup

```bash
git clone https://github.com/aiwithenoch/agentpresent.git
cd agentpresent
npm install
npm run check
```

## Workflow

1. Create a focused branch.
2. Make one clear change.
3. Add or update tests.
4. Run `npm run check`.
5. Open a pull request explaining the problem and solution.

## Design rules

- Keep the core provider-agnostic.
- Do not require a hosted AgentPresent service.
- Minimize collection and storage of location data.
- Keep agent callbacks explicit and inspectable.
- Prefer small interfaces over vendor-specific assumptions.
- Treat timers as internal wake-ups, not proof that a condition is true.

## Commit style

Use clear messages such as:

```text
feat: add OSRM route provider
fix: cancel pending monitor safely
test: cover changing ETA behavior
docs: explain custom location providers
```

## Pull requests

Include:

- What changed
- Why it changed
- How it was tested
- Privacy or security impact
- Any follow-up work

By contributing, you agree that your contribution may be distributed under the MIT License.
