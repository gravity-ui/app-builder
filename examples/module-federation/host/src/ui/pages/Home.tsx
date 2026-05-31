export function Home() {
    return (
        <section className="home">
            <h1>Welcome to the host shell</h1>
            <p>
                This page is rendered by the <code>host</code> app. Use the navigation above to load
                one of three remote microfrontends. Each microfrontend is built and served
                independently with <code>@gravity-ui/app-builder</code>.
            </p>
            <ul>
                <li>
                    <code>mf-products</code> — http://localhost:3001
                </li>
                <li>
                    <code>mf-cart</code> — http://localhost:3002
                </li>
                <li>
                    <code>mf-profile</code> — http://localhost:3003
                </li>
            </ul>
        </section>
    );
}
