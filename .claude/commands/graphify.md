You are using the Graphify skill to build or query a knowledge graph.

**Instructions:**
- If no path is specified, use `.` (current directory)
- If a GitHub URL is given, clone first with `graphify clone <url>`, then run the pipeline on the cloned path
- The CLI command is `graphify` (installed via `uv tool install graphifyy`)
- Source the uv env first: `source $HOME/.local/bin/env`
- Graph output goes to `graphify-out/` in the target directory
- For querying existing graphs: `graphify query "..."`, `graphify path "A" "B"`, `graphify explain "X"`

**Full skill reference:** Read `~/.claude/skills/graphify/SKILL.md` for detailed steps.

**User's request:** $ARGUMENTS
