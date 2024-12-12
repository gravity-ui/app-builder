import {InfoButtons} from '@/containers/InfoButtons/InfoButtons';
import {useThemeStore} from '@/store/theme';
import {block} from '@/utils/cn';

import './Home.scss';

const b = block('home');

export function Home() {
    const {theme} = useThemeStore();

    return (
        <div className={b()}>
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
        </div>
    );
}
