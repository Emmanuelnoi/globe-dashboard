# 3D Global Dashboard - Documentation

Technical documentation for the 3D Global Dashboard, an interactive geography learning platform with WebGL globe, quiz games, and bird migration visualization.

---

## Quick Links

| Getting Started                                  | Core Concepts                                          | Operations                                         |
| ------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------- |
| [Development Setup](./development/setup.md)      | [Architecture Overview](./architecture/overview.md)    | [CI/CD Pipeline](./deployment/ci-cd.md)            |
| [Workflow Guide](./development/workflow.md)      | [State Management](./architecture/state-management.md) | [Deployment Platforms](./deployment/platforms.md)  |
| [Code Conventions](./development/conventions.md) | [3D Rendering](./architecture/rendering.md)            | [Environment Config](./deployment/environments.md) |

---

## Documentation Structure

### Architecture (`architecture/`)

System design, patterns, and technical foundations.

| Document                                                  | Description                     |
| --------------------------------------------------------- | ------------------------------- |
| [overview.md](./architecture/overview.md)                 | System overview and principles  |
| [system-diagram.md](./architecture/system-diagram.md)     | Architecture diagrams (Mermaid) |
| [state-management.md](./architecture/state-management.md) | Signals, effects, offline-first |
| [rendering.md](./architecture/rendering.md)               | Three.js + Angular integration  |
| [components.md](./architecture/components.md)             | Component reference             |
| [services.md](./architecture/services.md)                 | Service layer reference         |
| [performance.md](./architecture/performance.md)           | Optimization strategies         |

### Development (`development/`)

Setup, workflow, and coding standards.

| Document                                       | Description                    |
| ---------------------------------------------- | ------------------------------ |
| [setup.md](./development/setup.md)             | Prerequisites and installation |
| [workflow.md](./development/workflow.md)       | Daily development cycle        |
| [conventions.md](./development/conventions.md) | Code style and Git workflow    |

### Testing (`testing/`)

Testing strategy, patterns, and best practices.

| Document                                             | Description                  |
| ---------------------------------------------------- | ---------------------------- |
| [strategy.md](./testing/strategy.md)                 | Testing philosophy and tools |
| [unit-integration.md](./testing/unit-integration.md) | Unit and integration tests   |
| [e2e.md](./testing/e2e.md)                           | Playwright E2E testing       |
| [best-practices.md](./testing/best-practices.md)     | Patterns and challenges      |

### Deployment (`deployment/`)

CI/CD, hosting, and infrastructure.

| Document                                        | Description               |
| ----------------------------------------------- | ------------------------- |
| [environments.md](./deployment/environments.md) | Environment configuration |
| [ci-cd.md](./deployment/ci-cd.md)               | GitHub Actions workflows  |
| [platforms.md](./deployment/platforms.md)       | Netlify and Vercel setup  |

### Data (`data/`)

Data architecture and caching.

| Document                            | Description           |
| ----------------------------------- | --------------------- |
| [data-flow.md](./data/data-flow.md) | Data flow and caching |

### Decisions (`decisions/`)

Architecture Decision Records (ADRs) and trade-offs.

| Document                                                     | Description          |
| ------------------------------------------------------------ | -------------------- |
| [trade-offs.md](./decisions/trade-offs.md)                   | Technical trade-offs |
| [adr-0001-tech-stack.md](./decisions/adr-0001-tech-stack.md) | Technology choices   |

---

## Quick Reference

### Essential Commands

```bash
pnpm start           # Development server
pnpm test            # Run tests
pnpm run build       # Production build
pnpm run lint        # Lint code
pnpm run e2e         # E2E tests
```

### Tech Stack

| Category        | Technology                     |
| --------------- | ------------------------------ |
| Frontend        | Angular 20 (Zoneless, Signals) |
| 3D Graphics     | Three.js 0.179.1               |
| Backend         | Supabase (PostgreSQL)          |
| Testing         | Vitest + Playwright            |
| Package Manager | pnpm                           |

### Key Metrics

- **Bundle Size:** 407kB gzipped
- **Test Coverage:** 487 blocking tests (100% pass)
- **Performance:** 60fps WebGL, <400ms API loads
- **Accessibility:** WCAG 2.1 AA compliant

---

## Navigation by Role

### New Developer

1. [Development Setup](./development/setup.md) - Get environment set up
2. [Architecture Overview](./architecture/overview.md) - Understand the big picture
3. [Workflow Guide](./development/workflow.md) - Learn development cycle

### Feature Developer

1. [Components](./architecture/components.md) - Component patterns
2. [Services](./architecture/services.md) - Service layer
3. [State Management](./architecture/state-management.md) - Signals and data flow

### DevOps Engineer

1. [CI/CD Pipeline](./deployment/ci-cd.md) - Workflows and automation
2. [Deployment Platforms](./deployment/platforms.md) - Netlify/Vercel
3. [Environment Config](./deployment/environments.md) - Variables and injection

### QA Engineer

1. [Testing Strategy](./testing/strategy.md) - Philosophy and tools
2. [E2E Testing](./testing/e2e.md) - Playwright patterns
3. [Best Practices](./testing/best-practices.md) - Common challenges

---

## Additional Resources

### Guides & Tutorials

- [guides/VERCEL_SETUP.md](./guides/VERCEL_SETUP.md) - Vercel deployment guide
- [guides/PERFORMANCE_TEST_GUIDE.md](./guides/PERFORMANCE_TEST_GUIDE.md) - Performance testing

### Reports

- [reports/CASE_STUDY.md](./reports/CASE_STUDY.md) - Detailed project case study
- [reports/SPRINT1_COMPLETION_REPORT.md](./reports/SPRINT1_COMPLETION_REPORT.md) - Sprint outcomes

### Legal & Security

- [legal/PRIVACY_POLICY.md](./legal/PRIVACY_POLICY.md) - Privacy policy
- [legal/TERMS_OF_SERVICE.md](./legal/TERMS_OF_SERVICE.md) - Terms of service
- [legal/ACCESSIBILITY_STATEMENT.md](./legal/ACCESSIBILITY_STATEMENT.md) - WCAG compliance
- [security/SECURITY.md](./security/SECURITY.md) - Security policy

### Community

- [community/CONTRIBUTING.md](./community/CONTRIBUTING.md) - Contribution guidelines
- [community/COMMIT_GUIDE.md](./community/COMMIT_GUIDE.md) - Commit conventions

---

## Legacy Documentation

The following files are deprecated and being migrated:

| Old File               | New Location           |
| ---------------------- | ---------------------- |
| `ARCHITECTURE.md`      | `architecture/` folder |
| `TESTING.md`           | `testing/` folder      |
| `DEVELOPMENT_GUIDE.md` | `development/` folder  |
| `DEPLOYMENT.md`        | `deployment/` folder   |
| `TRADE_OFFS.md`        | `decisions/` folder    |

---

## Contributing to Documentation

1. Keep documentation in sync with code
2. Follow existing formatting conventions
3. Update docs when making architectural changes
4. Add examples for new features

---

**Last Updated:** January 2026
