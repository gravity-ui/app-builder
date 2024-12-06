interface Window {
    links?: {rel: string; href: string}[];
}

declare module '*.svg' {
    import type {FC, SVGProps} from 'react';
    const SVG: FC<SVGProps<SVGSVGElement>>;
    export default SVG;
}

declare module '*.module.css';
declare module '*.module.scss';
