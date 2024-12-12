export interface Link {
    rel: string;
    href: string;
}

import {getRootClassName} from '@gravity-ui/uikit/server';

import {useThemeStore} from '@/store/theme';

interface DocumentProps {
    links: Link[];
    children: React.ReactNode;
}

export function Document({links, children}: DocumentProps) {
    const {theme} = useThemeStore();

    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Gravity UI app-builder example</title>
                {links.map((link, index) => (
                    <link key={index} {...link} />
                ))}
            </head>
            <body className={getRootClassName({theme})}>{children}</body>
        </html>
    );
}
