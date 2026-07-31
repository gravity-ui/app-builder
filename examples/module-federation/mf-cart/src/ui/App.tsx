import {useState} from 'react';

type CartItem = {id: number; name: string; quantity: number};

const INITIAL_CART: CartItem[] = [
    {id: 1, name: 'Mechanical keyboard', quantity: 1},
    {id: 2, name: 'USB-C dock', quantity: 2},
];

export default function CartApp() {
    const [items, setItems] = useState(INITIAL_CART);

    const updateQuantity = (id: number, delta: number) => {
        setItems((current) =>
            current
                .map((item) =>
                    item.id === id ? {...item, quantity: item.quantity + delta} : item,
                )
                .filter((item) => item.quantity > 0),
        );
    };

    return (
        <section className="mf-card">
            <h2>🧺 Cart</h2>
            <p>
                Owned by the <code>mf-cart</code> microfrontend.
            </p>
            {items.length === 0 ? (
                <p>Your cart is empty.</p>
            ) : (
                <ul>
                    {items.map((item) => (
                        <li key={item.id} className="mf-card__counter">
                            <span>{item.name}</span>
                            <button
                                type="button"
                                className="mf-card__button"
                                onClick={() => updateQuantity(item.id, -1)}
                            >
                                −
                            </button>
                            <strong>{item.quantity}</strong>
                            <button
                                type="button"
                                className="mf-card__button"
                                onClick={() => updateQuantity(item.id, 1)}
                            >
                                +
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
