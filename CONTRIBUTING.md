# Contributing

Thank you for your interest in contributing to Presense!

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/Presense.git`
3. **Install** dependencies: `npm install`
4. **Set up** environment: `cp .env.example .env.local`
5. **Start** development: `npm run dev`

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing patterns and conventions
- Use `m.*` from Framer Motion (not `motion.*`)
- Use custom components (GlassCard, Sheet, Dropdown) over shadcn/ui when possible

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Keep commits focused and atomic
- Reference issues when applicable

### Testing
- Test on mobile viewport
- Test with reduced motion enabled
- Verify no regressions in existing functionality

### Performance
- Minimize bundle size changes
- Use lazy loading for heavy components
- Respect `prefers-reduced-motion`

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details.

## Design System

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for design guidelines.

## Questions?

Open an issue for discussion before submitting large changes.
