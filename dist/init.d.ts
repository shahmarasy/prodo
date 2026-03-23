import { type SupportedAi } from "./agent-command-installer";
export declare function runInit(cwd: string, options?: {
    ai?: SupportedAi;
    lang?: string;
    preset?: string;
    script?: "sh" | "ps";
}): Promise<{
    installedAgentFiles: string[];
    settingsPath: string;
}>;
