export function parseAssetsIgnore(text: string): string[];
export function isAssetsIgnored(rel: string, patterns: readonly string[]): boolean;
export function deletedOnMain(repo: string, mainRef: string): Set<string>;
export function collectProblems(repo: string, mainRef?: string): string[];
