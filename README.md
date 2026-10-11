# claudeagentsskills

Claude Code skills, checked in as project skills under `.claude/skills/` so they
load automatically in any Claude Code session opened in this repo.

## Instagram agent skills (`ig-*`)

Vendored from [Jakeschincariol/instagram-agent-skill](https://github.com/Jakeschincariol/instagram-agent-skill)
at commit `d03c56b` (MIT, see `.claude/skills/LICENSE-instagram-agent-skill`).

`ig-audit`, `ig-caption`, `ig-carousel`, `ig-comment`, `ig-dm`, `ig-human`,
`ig-plan`, `ig-profile`, `ig-reel`, `ig-reply`, `ig-repurpose`, `ig-story`, `ig-viral`

Several skills read a voice profile from `~/.claude/instagram/voice.md`. Start
from `templates/voice.md`, fill it in, and copy it there.

### Installing user-wide instead

Windows (PowerShell):

```powershell
git clone https://github.com/silentknight-sudo/claudeagentsskills.git
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse claudeagentsskills\.claude\skills\ig-* "$env:USERPROFILE\.claude\skills\"
```

macOS / Linux:

```bash
git clone https://github.com/silentknight-sudo/claudeagentsskills.git
mkdir -p ~/.claude/skills && cp -r claudeagentsskills/.claude/skills/ig-* ~/.claude/skills/
```
