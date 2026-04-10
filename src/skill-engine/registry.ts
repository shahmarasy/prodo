import { UserError } from "../core/errors";
import type { Skill, SkillManifest } from "./types";

function validateManifest(manifest: SkillManifest): string | null {
  if (!manifest.name || typeof manifest.name !== "string") return "Skill name is required";
  if (!manifest.version || typeof manifest.version !== "string") return "Skill version is required";
  if (!manifest.description || typeof manifest.description !== "string") return "Skill description is required";

  const validCategories = ["core", "artifact", "validation", "custom"];
  if (!validCategories.includes(manifest.category)) {
    return `Invalid category "${manifest.category}". Must be: ${validCategories.join(", ")}`;
  }

  if (!Array.isArray(manifest.depends_on)) return "depends_on must be an array";
  if (!Array.isArray(manifest.inputs)) return "inputs must be an array";
  if (!Array.isArray(manifest.outputs)) return "outputs must be an array";

  const validTypes = ["string", "path", "boolean", "json", "number"];
  for (const input of manifest.inputs) {
    if (!input.name || typeof input.name !== "string") return "Input name is required";
    if (!validTypes.includes(input.type)) return `Invalid input type "${input.type}" for "${input.name}"`;
  }
  for (const output of manifest.outputs) {
    if (!output.name || typeof output.name !== "string") return "Output name is required";
    if (!validTypes.includes(output.type)) return `Invalid output type "${output.type}" for "${output.name}"`;
  }

  return null;
}

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  register(skill: Skill): void {
    const error = validateManifest(skill.manifest);
    if (error) {
      throw new UserError(`Invalid skill manifest for "${skill.manifest?.name ?? "unknown"}": ${error}`);
    }
    if (typeof skill.execute !== "function") {
      throw new UserError(`Skill "${skill.manifest.name}" must export an execute function`);
    }
    if (this.skills.has(skill.manifest.name)) {
      throw new UserError(`Skill "${skill.manifest.name}" is already registered`);
    }
    this.skills.set(skill.manifest.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  listByCategory(category: string): Skill[] {
    return this.list().filter((s) => s.manifest.category === category);
  }

  listManifests(): SkillManifest[] {
    return this.list().map((s) => s.manifest);
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  size(): number {
    return this.skills.size;
  }
}
