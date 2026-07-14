/// <reference path="./client.d.ts" />

declare module '*.svg' {
    import type {FC, SVGProps} from 'react';
    const content: FC<SVGProps<SVGSVGElement>>;
    export default content;
}
