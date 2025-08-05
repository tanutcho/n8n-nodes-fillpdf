# Contributing to n8n-nodes-fillpdf

Thank you for your interest in contributing to the n8n-nodes-fillpdf community node! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to help us maintain a welcoming and inclusive community.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** 16.x or higher
- **Python** 3.7 or higher
- **Git** for version control
- **n8n** development environment
- **fillpdf** Python library

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/n8n-nodes-fillpdf.git
   cd n8n-nodes-fillpdf
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/n8n-nodes-fillpdf.git
   ```

## Development Setup

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install fillpdf

# Install development dependencies
npm install --dev
```

### 2. Build the Project

```bash
# Build TypeScript
npm run build

# Watch for changes during development
npm run dev
```

### 3. Link for Local Testing

```bash
# Link the package globally
npm link

# In your n8n installation directory
npm link n8n-nodes-fillpdf
```

### 4. Set Up n8n Development Environment

```bash
# Clone n8n (if needed for testing)
git clone https://github.com/n8n-io/n8n.git
cd n8n

# Install n8n dependencies
npm install

# Start n8n in development mode
npm run dev
```

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- **Bug fixes**: Fix issues and improve stability
- **Features**: Add new functionality
- **Documentation**: Improve guides, examples, and API docs
- **Tests**: Add or improve test coverage
- **Performance**: Optimize code and reduce resource usage
- **Refactoring**: Improve code structure and maintainability

### Coding Standards

#### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Follow **ESLint** configuration with **n8n-nodes-base** plugin
- Use **Prettier** for code formatting
- Follow **n8n node conventions** and standards

```bash
# Check linting (includes TypeScript check, ESLint, and Prettier)
npm run lint

# Fix linting issues and format code
npm run lint:fix

# Format code only
npm run format

# Check formatting only
npm run format:check
```

**n8n-Specific Rules:**
- Node class descriptions must follow n8n conventions
- Parameter descriptions must be properly formatted
- Display names must be correctly cased
- Default values must match parameter types
- All node parameters must have proper validation

#### Python

- Follow **PEP 8** style guide
- Use **type hints** where appropriate
- Add **docstrings** for functions and classes
- Keep Python code minimal and focused

#### General Guidelines

- Write **clear, descriptive commit messages**
- Keep **functions small and focused**
- Add **comments for complex logic**
- Use **meaningful variable names**
- Follow **existing code patterns**

### Commit Message Format

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat(node): add support for radio button fields
fix(validation): handle empty PDF files gracefully
docs(readme): add troubleshooting section
test(integration): add batch processing tests
```

## Pull Request Process

### Before Submitting

1. **Update your fork**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** following the coding standards

4. **Test your changes**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```

5. **Update documentation** if needed

### Submitting the Pull Request

1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub with:
   - **Clear title** describing the change
   - **Detailed description** of what was changed and why
   - **Link to related issues** (if applicable)
   - **Screenshots** (for UI changes)
   - **Testing instructions**

3. **Fill out the PR template** completely

### PR Review Process

1. **Automated checks** must pass (CI/CD, linting, tests)
2. **Code review** by maintainers
3. **Address feedback** and make requested changes
4. **Final approval** and merge by maintainers

## Issue Reporting

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for solutions
3. **Test with latest version**
4. **Gather relevant information**

### Bug Reports

Include the following information:

```markdown
**Bug Description**
A clear description of the bug

**Steps to Reproduce**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- n8n version:
- Node version:
- Python version:
- Operating System:
- fillpdf version:

**Additional Context**
- Error messages
- Screenshots
- Workflow JSON (if applicable)
- Log files
```

### Feature Requests

Include the following information:

```markdown
**Feature Description**
Clear description of the proposed feature

**Use Case**
Why is this feature needed?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other approaches you've considered

**Additional Context**
Any other relevant information
```

## Development Workflow

### Project Structure

```
n8n-nodes-fillpdf/
├── nodes/
│   └── FillPdf/
│       ├── FillPdf.node.ts          # Main node implementation
│       ├── types.ts                 # TypeScript interfaces
│       ├── validation.ts            # Input validation
│       ├── python-bridge.ts         # Python integration
│       ├── field-inspector.ts       # PDF field detection
│       ├── field-mapper.ts          # Field mapping logic
│       ├── pdf-processor.ts         # PDF processing
│       ├── output-handler.ts        # Output formatting
│       ├── errors.ts                # Error handling
│       └── fillpdf-processor.py     # Python script
├── tests/                           # Test files
├── docs/                           # Documentation
├── package.json                    # Node.js package config
├── tsconfig.json                   # TypeScript config
├── jest.config.js                  # Test configuration
└── README.md                       # Main documentation
```

### Key Components

#### Node Implementation (`FillPdf.node.ts`)
- Main n8n node class
- Configuration schema
- Execution logic
- Error handling

#### Python Bridge (`python-bridge.ts`)
- Subprocess management
- Data serialization
- Error propagation

#### Validation (`validation.ts`)
- Parameter validation
- Safety checks
- Input sanitization

### Development Commands

```bash
# Development
npm run dev          # Watch and rebuild
npm run build        # Build production
npm run clean        # Clean build files

# Testing (currently being refactored)
npm run build        # Verify TypeScript compilation
npm run lint         # Verify code quality and n8n standards
npm run audit        # Verify security

# Quality
npm run lint         # Check linting
npm run lint:fix     # Fix linting issues
npm run format       # Format code

# Security
npm run audit        # Security audit
npm run audit:fix    # Fix vulnerabilities

# Release
npm run prepare      # Pre-commit hooks
npm run release      # Create release
```

## Testing

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── node.test.ts
│   ├── validation.test.ts
│   └── python-bridge.test.ts
├── integration/             # Integration tests
│   ├── fillpdf-integration.test.ts
│   └── error-scenarios.test.ts
├── fixtures/               # Test data
│   ├── sample.pdf
│   └── test-data.json
└── setup.ts               # Test setup
```

### Writing Tests

#### Unit Tests

```typescript
import { FillPdfNode } from '../nodes/FillPdf/FillPdf.node';

describe('FillPdfNode', () => {
  it('should validate required parameters', () => {
    // Test implementation
  });
});
```

#### Integration Tests

```typescript
describe('PDF Processing Integration', () => {
  it('should fill PDF with sample data', async () => {
    // Test with real PDF files
  });
});
```

### Test Guidelines

- **Write tests** for all new features
- **Update tests** when changing existing code
- **Use descriptive test names**
- **Test both success and error cases**
- **Mock external dependencies** appropriately
- **Keep tests fast and reliable**

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- validation.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Documentation

### Types of Documentation

1. **Code Documentation**
   - Inline comments
   - JSDoc/TSDoc comments
   - Type definitions

2. **User Documentation**
   - README.md
   - Installation guides
   - Usage examples

3. **Developer Documentation**
   - Contributing guide
   - API documentation
   - Architecture decisions

### Documentation Standards

- **Keep documentation up-to-date** with code changes
- **Use clear, concise language**
- **Include practical examples**
- **Add screenshots** for UI features
- **Link related sections**

### Building Documentation

```bash
# Generate API docs
npm run docs:generate

# Serve docs locally
npm run docs:serve

# Build docs for production
npm run docs:build
```

## Release Process

### Version Management

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update version** in package.json
2. **Update CHANGELOG.md**
3. **Create release PR**
4. **Tag release** after merge
5. **Publish to npm**
6. **Create GitHub release**

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **n8n Community**: n8n-specific questions
- **Email**: Direct contact for sensitive issues

### Resources

- [n8n Node Development Guide](https://docs.n8n.io/integrations/creating-nodes/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [fillpdf Python Library](https://pypi.org/project/fillpdf/)

## Security

### Security Best Practices

- **Dependency Management**: Regularly update dependencies and run security audits
- **Input Validation**: Always validate and sanitize user inputs
- **Error Handling**: Don't expose sensitive information in error messages
- **File Operations**: Use secure file handling practices
- **Python Execution**: Validate Python script inputs and limit execution time

### Security Auditing

```bash
# Run security audit before committing
npm run audit

# Fix vulnerabilities automatically
npm run audit:fix

# Check for outdated packages
npm outdated
```

### Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** create a public GitHub issue
2. **Email** the maintainers directly
3. **Provide** detailed information about the vulnerability
4. **Wait** for confirmation before public disclosure

## Recognition

Contributors will be recognized in:

- **CONTRIBUTORS.md** file
- **GitHub contributors** section
- **Release notes** for significant contributions
- **Special thanks** in documentation

Thank you for contributing to n8n-nodes-fillpdf! 🎉