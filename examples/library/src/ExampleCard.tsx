import type {HTMLAttributes} from 'react';

import {formatMetadata} from '@/utils/formatMetadata';

import './ExampleCard.scss';

export interface ExampleCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    title: string;
    metadata?: Record<string, string>;
    tags?: readonly string[];
}

export function ExampleCard({
    title,
    metadata = {},
    tags = [],
    className,
    ...rest
}: ExampleCardProps) {
    const metadataItems = formatMetadata(metadata);
    const [firstTag, ...otherTags] = tags;
    const visibleTags = firstTag ? [firstTag, ...otherTags] : [];

    return (
        <article {...rest} className={['example-card', className].filter(Boolean).join(' ')}>
            <h2>{title}</h2>
            <dl className="example-card__metadata">
                {metadataItems.map(({key, value}) => (
                    <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
            <ul className="example-card__tags">
                {visibleTags.map((tag) => (
                    <li key={tag}>{tag}</li>
                ))}
            </ul>
        </article>
    );
}

export async function createExampleCardProps(
    title: string,
    metadata: Record<string, string>,
): Promise<ExampleCardProps> {
    const normalizedMetadata = await Promise.resolve({...metadata});

    return {
        title,
        metadata: normalizedMetadata,
        tags: Object.values(normalizedMetadata).filter(Boolean),
    };
}
