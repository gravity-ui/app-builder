export type Link = {};

import {Moon, Sun} from '@gravity-ui/icons';
import {Button, Icon, ThemeProvider} from '@gravity-ui/uikit';
import {getRootClassName} from '@gravity-ui/uikit/server';

import {InfoButtons} from '@/containers/InfoButtons/InfoButtons';
import {useThemeStore} from '@/store/theme';
import type {Theme} from '@/store/theme';
import {block} from '@/utils/cn';

import * as styles from './App.module.scss';
import './App.scss';

const b = block('app');

export function App({links, theme: serverTheme}: {links: Link[]; theme?: Theme}) {
    const {theme: clientTheme, setTheme} = useThemeStore();
    const theme = serverTheme ?? clientTheme;

    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Gravity UI app-builder example</title>
                {links.map((link, index) => (
                    <link key={index} {...link} />
                ))}
            </head>
            <body className={getRootClassName({theme}, styles.app)}>
                <ThemeProvider theme={theme}>
                    <main className="main">
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
                        <div className={b('layout')}>
                            <div className={b('header')}>
                                <div className={b('logo')}>
                                    <div className={b('gravity-logo', {dark: theme === 'dark'})} />
                                    <div className={b('vite-logo')} />
                                </div>
                            </div>
                            <div className={b('content')}>
                                <InfoButtons />
                            </div>
                        </div>
                    </main>
                </ThemeProvider>
            </body>
        </html>
    );
}
