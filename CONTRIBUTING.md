# Contributing to skill-guide

Thanks for your interest! Here's how to contribute.

## Bug Reports

Open an issue with:
- What you expected to happen
- What actually happened
- Your OS and Node.js version (`node --version`)
- The scanner output if relevant (`node scan-skills.js --list 2>&1`)

## Feature Requests

Open an issue describing the use case. Good requests explain **who** needs it and **why**, not just what.

## Pull Requests

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make changes — keep the zero-dependency constraint
4. Test: `node scan-skills.js --list`, `node scan-skills.js --skill <name>`, `node scan-skills.js --search test`
5. Commit with conventional commits: `feat:`, `fix:`, `docs:`
6. Open a PR

## Constraints

- **Zero npm dependencies** — only Node.js built-ins (`fs`, `path`, `os`)
- **Single-file scanner** — `scan-skills.js` stays as one file
- **SKILL.md format** — must follow Claude Code skill frontmatter conventions
- **No external network calls** — scanner reads local files only

## Development

```bash
# Test the scanner
node scan-skills.js --list
node scan-skills.js --skill investigate
node scan-skills.js --search security
node scan-skills.js --full
node scan-skills.js --refresh --list

# Check what skills you have
node scan-skills.js --list | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['totalCount'], 'skills')"
```
