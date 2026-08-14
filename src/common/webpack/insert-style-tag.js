/* eslint-env browser */

const ATTR = 'data-ab-styleid';

function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h * 31 + str.charCodeAt(i)) % 4294967291;
    }
    return h.toString(36);
}

/**
 * Inserts a style tag into <head> unless an identical one is already present.
 * Dedup is keyed by a content hash stored on the tag,
 * and reflects DOM removals (HMR) automatically.
 *
 * @param {HTMLStyleElement} $targetStyle - The style element to be inserted
 * @returns {void}
 */
function insertStyleTag($targetStyle) {
    // style-loader passes an empty <style> and fills its content right after this
    // call returns, so the content is not available synchronously.
    queueMicrotask(() => {
        const html = $targetStyle.innerHTML;
        const id = hash(html);
        const $existing = document.head.querySelector(`style[${ATTR}="${id}"]`);
        // innerHTML check guards against the rare hash collision
        if ($existing && $existing.innerHTML === html) {
            return;
        }
        $targetStyle.setAttribute(ATTR, id);
        document.head.appendChild($targetStyle);
    });
}

export default insertStyleTag;
