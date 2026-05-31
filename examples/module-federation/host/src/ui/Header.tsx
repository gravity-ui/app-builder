import {NavLink} from 'react-router';

const NAV_ITEMS = [
    {to: '/', label: 'Home', end: true},
    {to: '/products', label: 'Products'},
    {to: '/cart', label: 'Cart'},
    {to: '/profile', label: 'Profile'},
];

export function Header() {
    return (
        <header className="app-header">
            <div className="app-header__brand">🛰 Module Federation Demo</div>
            <nav className="app-header__nav">
                {NAV_ITEMS.map(({to, label, end}) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({isActive}) =>
                            `app-header__link${isActive ? ' app-header__link--active' : ''}`
                        }
                    >
                        {label}
                    </NavLink>
                ))}
            </nav>
        </header>
    );
}
