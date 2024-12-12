import {Link} from '@gravity-ui/uikit';
import {Outlet, useLinkClickHandler} from 'react-router';

import * as styles from './Layout.module.scss';

export function Layout() {
    const navigateToHome = useLinkClickHandler('/');
    const navigateToAbout = useLinkClickHandler('/about');
    return (
        <div className={styles.layout}>
            <nav className={styles.layout__navigation}>
                <ul>
                    <li>
                        <Link href="/" onClick={navigateToHome}>
                            Home
                        </Link>
                    </li>
                    <li>
                        <Link href="/About" onClick={navigateToAbout}>
                            About
                        </Link>
                    </li>
                </ul>
            </nav>
            <main>
                <Outlet />
            </main>
        </div>
    );
}
