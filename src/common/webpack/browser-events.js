/* eslint-env browser */

const NAMESPACE = 'app-builder';

export const BrowserEvents = {
    PublicPathFallback: `${NAMESPACE}:public-path-fallback`,
};

export function dispatchBrowserEvent(name, detail) {
    if (typeof window === 'undefined' || typeof window.CustomEvent !== 'function') {
        return;
    }

    window.dispatchEvent(new CustomEvent(name, {detail}));
}
