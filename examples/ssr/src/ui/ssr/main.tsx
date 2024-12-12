import {StaticRouter} from 'react-router';

import {App} from '@/containers/App/App';
import {Document, Link} from '@/containers/Document/Document';
import {type Theme, ThemeStoreProvider, createThemeStore} from '@/store/theme';

interface Props {
    links: Link[];
    theme: Theme;
    url: string;
}

export function render({links, theme, url}: Props) {
    return (
        <StaticRouter location={url}>
            <ThemeStoreProvider store={createThemeStore(theme)}>
                <Document links={links}>
                    <App />
                </Document>
            </ThemeStoreProvider>
        </StaticRouter>
    );
}
