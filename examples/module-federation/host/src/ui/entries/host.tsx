import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router';

import {App} from '../App';
import '../styles.css';

const container = document.getElementById('root');

if (!container) {
    throw new Error('Root container #root is missing in index.html');
}

createRoot(container).render(
    <HashRouter>
        <App />
    </HashRouter>,
);
