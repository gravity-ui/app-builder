/**
 * nginx config templating — pure, no I/O.
 *
 * Substitutes `${NAME}` placeholders from an explicit params map, mimicking `envsubst` with a
 * whitelist: only keys present in `params` are replaced; every other `${...}` and all unbraced
 * nginx variables (`$host`, `$scheme`, ...) are left untouched.
 */

/** Command that tells a running nginx to pick up the new config. */
export const DEFAULT_RELOAD_COMMAND = 'sudo nginx -s reload';

export function render(template: string, params: Record<string, string>): string {
    return template.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) =>
        name in params ? params[name] : match,
    );
}
