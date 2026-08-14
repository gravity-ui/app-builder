export interface MetadataItem {
    key: string;
    value: string;
}

export function formatMetadata(metadata: Record<string, string>): MetadataItem[] {
    return Object.entries(metadata).map(([key, value]) => ({key, value}));
}
