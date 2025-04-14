/* eslint-env browser */

/**
 * This function inserts a style tag into the document head if it doesn't already exist.
 * It is needed to do not allow duplicate style tags.
 *
 * @param {HTMLStyleElement} $targetStyle - The style element to be inserted
 * @returns {void}
 */
function insertStyleTag($targetStyle) {
    // setTimeout is used to queue the insertion of the style tag
    // to the end of the current event loop, allowing other
    setTimeout(() => {
        const $head = document.head;

        let targetStyleExists = false;

        $head.querySelectorAll('style').forEach(($style) => {
            if ($style.innerHTML === $targetStyle.innerHTML) {
                targetStyleExists = true;
            }
        });

        if (!targetStyleExists) {
            $head.appendChild($targetStyle);
        }
    });
}

module.exports = insertStyleTag;
