# Contributing to MemoChat

Thank you for your interest in contributing to MemoChat! 🎉

## 🚀 Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/memochat-backend.git
   cd memochat-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📝 Code Style

- Follow the existing code patterns and conventions
- Use ESLint configuration: `npm run lint`
- Format code with Prettier: `npm run format`
- Write meaningful commit messages (see below)
- Add tests for new features
- Update documentation as needed

## 🔀 Pull Request Process

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes** with clear, focused commits
   ```bash
   git commit -m "feat: add amazing feature"
   ```

3. **Ensure all tests pass**
   ```bash
   npm test
   npm run lint
   ```

4. **Update documentation** if needed
   - Update README.md for user-facing changes
   - Update API.md for API changes
   - Add entries to CHANGELOG.md

5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Submit a Pull Request**
   - Use the PR template
   - Provide clear description of changes
   - Reference related issues
   - Add screenshots for UI changes

## 📋 Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add volume control slider
fix: resolve WebRTC connection issue
docs: update API documentation
```

## 🐛 Reporting Issues

When reporting bugs, please include:

- **Clear description** of the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Environment details** (OS, browser, Node version)
- **Screenshots** if applicable
- **Error messages** from console

## 💡 Suggesting Features

For feature requests:

- Check if it's already been suggested
- Explain the use case and benefits
- Provide examples or mockups if possible
- Be open to discussion and feedback

## 🧪 Testing

- Write unit tests for new functions
- Write integration tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage

Run tests:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## 📚 Documentation

Good documentation helps everyone:

- Comment complex code logic
- Update API documentation for endpoint changes
- Add JSDoc comments for functions
- Update README for user-facing changes
- Include examples where helpful

## 🤝 Code Review

- Be respectful and constructive
- Explain your reasoning
- Be open to feedback
- Focus on the code, not the person
- Approve when ready, request changes if needed

## 🎯 Areas to Contribute

Looking for ideas? Check out:

- [Good First Issues](https://github.com/izzethannn/memochat-backend/labels/good%20first%20issue)
- [Help Wanted](https://github.com/izzethannn/memochat-backend/labels/help%20wanted)
- [Feature Requests](https://github.com/izzethannn/memochat-backend/labels/enhancement)
- The roadmap in README.md

## 📞 Getting Help

- Open a [Discussion](https://github.com/izzethannn/memochat-backend/discussions) for questions
- Join our community chat (if available)
- Check existing issues and documentation

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for making MemoChat better! 🚀
