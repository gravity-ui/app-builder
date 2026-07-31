import {Suspense, lazy} from 'react';
import {Route, Routes} from 'react-router';

import {Header} from './Header';
import {Home} from './pages/Home';

const ProductsApp = lazy(() => import('mf_products/App'));
const CartApp = lazy(() => import('mf_cart/App'));
const ProfileApp = lazy(() => import('mf_profile/App'));

export function App() {
    return (
        <div className="app-shell">
            <Header />
            <main className="app-shell__main">
                <Suspense fallback={<p className="app-shell__loader">Loading microfrontend…</p>}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/products/*" element={<ProductsApp />} />
                        <Route path="/cart/*" element={<CartApp />} />
                        <Route path="/profile/*" element={<ProfileApp />} />
                    </Routes>
                </Suspense>
            </main>
        </div>
    );
}
