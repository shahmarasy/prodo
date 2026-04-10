import { type SupportedAi } from "./agent-command-installer";
export type InitSelections = {
    ai?: SupportedAi;
    script: "sh" | "ps";
    lang: string;
    author: string;
    interactive: boolean;
};
type GatherInitUiOptions = {
    projectRoot: string;
    aiInput?: string;
    langInput?: string;
    authorInput?: string;
};
export declare function gatherInitSelections(options: GatherInitUiOptions): Promise<InitSelections>;
export declare function finishInitInteractive(summary: {
    projectRoot: string;
    settingsPath: string;
    ai?: SupportedAi;
    lang: string;
    author: string;
}): Promise<void>;
export {};
