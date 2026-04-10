import type { Skill } from "./types";
export declare function discoverSkills(cwd: string, log?: (message: string) => void): Promise<Skill[]>;
