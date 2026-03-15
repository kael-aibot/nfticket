# Contributing to NFTicket

Thank you for your interest in contributing to NFTicket! We welcome contributions from the community.

## 🚀 Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Follow the [Quick Start guide](README.md#quick-start) to set up your development environment
4. Create a new branch for your feature or fix

## 📋 Development Workflow

### Setting Up the Development Environment

```bash
# Install all dependencies
npm run install:all

# Start both apps in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

- `apps/provider/` — Event organizer portal
- `apps/app/` — Ticket buyer mobile app
- `apps/shared/` — Shared hooks and utilities
- `anchor-program/` — Solana smart contract
- `docs/` — Documentation

## 📝 Guidelines

### Code Style

- Use TypeScript for all new code
- Follow the existing code style and formatting
- Run `npm run lint` before committing
- Run `npm run format` to auto-format code

### Commit Messages

Use conventional commits:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, no logic change)
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Build process or auxiliary tool changes

Example:
```
feat: add time-decay visualization to event creation
```

### Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the docs/ folder with any new documentation
3. Ensure all tests pass
4. Update the CHANGELOG.md with your changes
5. Request review from maintainers
6. Address any review feedback

## 🧪 Testing

### Unit Tests

```bash
npm run test:unit
```

### Integration Tests

```bash
npm run test:integration
```

### Manual Testing

When testing the app:

1. Test on Solana devnet
2. Use the [Solana Faucet](https://faucet.solana.com/) for test SOL
3. Test both provider and buyer flows
4. Verify QR code scanning works
5. Test edge cases (sold out events, invalid tickets, etc.)

## 🐛 Reporting Bugs

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Environment details (OS, browser, wallet used)

## 💡 Feature Requests

We welcome feature requests! Please:

- Check if the feature has already been requested
- Provide clear use case and motivation
- Consider the impact on both providers and buyers
- Be open to discussion and iteration

## 🔒 Security

If you discover a security vulnerability, please:

1. **DO NOT** open a public issue
2. Email security@nfticket.app with details
3. Allow time for the issue to be resolved before disclosing publicly

## 📜 Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## 🙏 Recognition

Contributors will be recognized in our README and release notes.

## 📞 Questions?

- Join our [Discord](https://discord.gg/nfticket)
- Open a [Discussion](https://github.com/yourusername/nfticket/discussions)

Thank you for contributing to NFTicket! 🎫
