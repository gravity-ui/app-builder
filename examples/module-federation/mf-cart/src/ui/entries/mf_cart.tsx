import {createRoot} from 'react-dom/client';

import App from '../App';

const container = document.getElementById('root');

if (!container) {
    throw new Error('Root container #root is missing in index.html');
}

createRoot(container).render(
    <div style={{padding: 32, fontFamily: 'system-ui, sans-serif'}}>
        <p style={{color: '#888'}}>
            Standalone preview of <strong>mf-cart</strong>. In production this module is loaded
            inside the host shell.
        </p>
        <App />
    </div>,
);
