# Writing Effective Briefs

The `brief.md` file is the single input to Prodo's pipeline. A well-structured brief leads to higher-quality artifacts and fewer validation issues.

## Recommended Structure

```markdown
# Product Name
MyApp

# Problem
Describe the core problem your product solves. Be specific about who suffers
from this problem and what the current workaround is.

# Audience
- Primary users (e.g., Product Managers)
- Secondary users (e.g., Engineering Leads)
- Stakeholders (e.g., C-suite)

# Goals
- Reduce time-to-market by 50%
- Increase team alignment on requirements
- Automate repetitive documentation tasks

# Core Features
- Brief normalization with AI-assisted clarification
- PRD generation from structured requirements
- Cross-artifact validation with traceability
- Multi-screen wireframe generation

# Constraints
- Must work offline (no mandatory cloud dependency)
- Node.js 20+ runtime requirement
- English and Turkish language support
- Must integrate with existing CI/CD pipelines

# Assumptions
- Teams have access to at least one LLM provider
- Product managers will review generated artifacts before shipping
```

## Tips for High-Confidence Normalization

1. **Be specific in Goals**: "Improve UX" is vague. "Reduce checkout abandonment by 30%" is concrete.
2. **List distinct features**: Each bullet should describe one capability. Don't combine multiple features.
3. **Name your audience**: "Users" is generic. "Small business owners managing inventory" is specific.
4. **State constraints clearly**: Technical, business, and regulatory constraints all matter.
5. **Use consistent terminology**: If you call it "checkout" in one place, don't call it "purchase flow" elsewhere.

## Heading Variations

Prodo recognizes these heading variations:

| Canonical | Also Accepted |
|-----------|--------------|
| Product Name | Project Name, Name |
| Problem | Problem Statement |
| Audience | Users, Persona |
| Goals | Objectives |
| Core Features | Features, Capabilities |
| Constraints | Limitations, Restrictions |
| Assumptions | Open Questions |

## Language

Set the document language during init:

```bash
prodo init . --lang tr
```

Or update `.prodo/settings.json`:

```json
{ "lang": "tr" }
```

Prodo enforces language consistency — if your project is Turkish, all generated artifacts will be checked for English leaks (and vice versa).

## Common Mistakes

- **Too vague**: "Build a good product" — no actionable requirements
- **Too long**: 10-page briefs overwhelm normalization. Keep it under 2 pages.
- **Missing sections**: Skipping Constraints or Assumptions leads to low confidence scores
- **Mixed languages**: Don't mix Turkish and English in the same brief
