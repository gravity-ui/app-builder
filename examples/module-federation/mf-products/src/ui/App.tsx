import {useMemo, useState} from 'react';

const ALL_PRODUCTS = [
    {id: 1, name: 'Mechanical keyboard', price: 129},
    {id: 2, name: 'Ergonomic mouse', price: 49},
    {id: 3, name: '4K monitor', price: 399},
    {id: 4, name: 'USB-C dock', price: 89},
    {id: 5, name: 'Noise-cancelling headphones', price: 259},
];

export default function ProductsApp() {
    const [query, setQuery] = useState('');

    const filtered = useMemo(
        () =>
            ALL_PRODUCTS.filter((product) =>
                product.name.toLowerCase().includes(query.trim().toLowerCase()),
            ),
        [query],
    );

    return (
        <section className="mf-card">
            <h2>🛒 Products</h2>
            <p>
                Owned by the <code>mf-products</code> microfrontend.
            </p>
            <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products…"
                style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #30363d',
                    background: '#0e1116',
                    color: 'inherit',
                    width: '100%',
                    marginTop: 12,
                }}
            />
            <ul style={{marginTop: 16}}>
                {filtered.map((product) => (
                    <li key={product.id}>
                        {product.name} — <strong>${product.price}</strong>
                    </li>
                ))}
                {filtered.length === 0 ? <li>No results</li> : null}
            </ul>
        </section>
    );
}
