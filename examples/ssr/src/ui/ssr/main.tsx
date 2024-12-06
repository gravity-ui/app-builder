import {App} from '@/containers/App/App';
import type {Link} from '@/containers/App/App';
import type {Theme} from '@/store/theme';

export function render({links, theme}: {links: Link[]; theme: Theme}) {
    return <App links={links} theme={theme} />;
}
