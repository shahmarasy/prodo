export type MarkdownSection = {
    heading: string;
    headingKey: string;
    level: number;
    textLines: string[];
    listItems: string[];
};
export declare function normalizeHeadingKey(heading: string): string;
export declare function parseMarkdownSections(markdown: string): MarkdownSection[];
export declare function extractRequiredHeadings(content: string): string[];
export type TaggedLine = {
    contractId: string;
    line: string;
};
export declare function taggedLinesByContract(body: string): TaggedLine[];
export declare function sectionTextMap(content: string): Map<string, string>;
