# Custom Agent Rules for this project

## Open Knowledge Format (OKF) Support
All knowledge files and documentation in this workspace must use the Open Knowledge Format (OKF) specification (v0.1):
1. Use the `.md` file extension.
2. Every file must begin with a YAML frontmatter block delimited by `---` containing at least the `type` field.
3. Every code block in these documents MUST be preceded by a Markdown heading describing the code block.

Example structure of an OKF file:
---
type: Guide
title: Example Guide
description: An example file following the OKF spec.
tags: [example, guide]
---

### Code: Python Example
```python
print("Hello, World!")
```
