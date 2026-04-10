type TranslationMap = Record<string, string>;
export declare function t(key: string, lang?: string): string;
export declare function loadTranslations(lang: string): TranslationMap;
export declare function availableLanguages(): string[];
export {};
