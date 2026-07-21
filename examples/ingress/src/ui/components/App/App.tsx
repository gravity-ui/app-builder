import {ThemeProvider} from '@gravity-ui/uikit';

export function App() {
    let name = 'World';
    try {
        const url = new URL(location.toString());
        name = url.searchParams.get('name') ?? 'World';
    } catch {
        // noop
    }
    return (
        <ThemeProvider theme="light">
            <h1>Hello, {name}!</h1>
        </ThemeProvider>
    );
}
