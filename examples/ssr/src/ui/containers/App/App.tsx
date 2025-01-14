import {Moon, Sun} from '@gravity-ui/icons';
import {Button, Icon, ThemeProvider} from '@gravity-ui/uikit';
import {Route, Routes} from 'react-router';

import {About} from '../About/About';
import {Home} from '../Home/Home';
import {Layout} from '../Layout/Layout';
import {NotFound} from '../NotFound/NotFound';

import {useThemeStore} from '@/store/theme';
import {block} from '@/utils/cn';

import './App.scss';

const b = block('app');

export function App() {
    const {theme, setTheme} = useThemeStore();

    return (
        <ThemeProvider theme={theme}>
            <div className={b('theme-button')}>
                <Button
                    size="l"
                    view="outlined"
                    onClick={() => {
                        setTheme(theme === 'light' ? 'dark' : 'light');
                    }}
                >
                    <Icon data={theme === 'dark' ? Sun : Moon} />
                </Button>
            </div>
            <Routes>
                <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="about" element={<About />} />
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </ThemeProvider>
    );
}
