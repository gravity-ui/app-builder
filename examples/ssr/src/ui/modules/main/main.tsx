import * as ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router';

import '@/styles/global.scss';
import '@gravity-ui/uikit/styles/styles.scss';

/* eslint-disable import/order */
import {Document} from '@/containers/Document/Document';
import {App} from '@/containers/App/App';
import {ThemeStoreProvider} from '@/store/theme';
/* eslint-enable import/order */

ReactDOM.hydrateRoot(
    document,
    <BrowserRouter>
        <ThemeStoreProvider>
            <Document links={window.links ?? []}>
                <App />
            </Document>
        </ThemeStoreProvider>
    </BrowserRouter>,
);
