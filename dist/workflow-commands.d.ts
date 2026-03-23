export type WorkflowCommand = {
    name: string;
    cliSubcommand: string;
    description: string;
};
export declare const WORKFLOW_COMMANDS: WorkflowCommand[];
export declare function buildWorkflowCommands(artifactTypes: string[]): WorkflowCommand[];
