import * as ReactDOM from 'react-dom/client';

import '@/styles/global.scss';
import '@gravity-ui/uikit/styles/styles.scss';

// eslint-disable-next-line import/order
import {App} from '@/containers/App/App';

ReactDOM.hydrateRoot(document, <App links={window.links ?? []} />);
