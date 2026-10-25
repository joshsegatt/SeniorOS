# Generic Agent Skills adapter

For hosts or packaging workflows that want a neutral project-local skill directory:

```bash
senior install --target generic --scope project
```

This installs to:

```text
.agents/skills/<skill-name>/SKILL.md
```

Use a host-specific adapter when the host has a documented discovery path.
