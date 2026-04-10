import nunjucks from "nunjucks";
export declare function renderTemplate(content: string, context: Record<string, unknown>): string;
export declare function getTemplateEnv(): nunjucks.Environment;
