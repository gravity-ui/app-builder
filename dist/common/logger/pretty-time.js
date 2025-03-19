"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.elapsedTime = elapsedTime;
exports.prettyTime = prettyTime;
const scale = {
    w: BigInt(6048e11),
    d: BigInt(864e11),
    h: BigInt(36e11),
    m: BigInt(6e10),
    s: BigInt(1e9),
    ms: BigInt(1e6),
    μs: BigInt(1e3),
    ns: BigInt(1),
};
function elapsedTime(time, smallest = 'ms') {
    const elapsed = process.hrtime.bigint() - time;
    return prettyTime(elapsed, smallest);
}
function prettyTime(time, smallest = 'ms') {
    let elapsed = time;
    let res = '';
    let count = 0;
    for (const [uom, step] of Object.entries(scale)) {
        if (count === 3) {
            break;
        }
        let inc = elapsed / step;
        if (inc === BigInt(0)) {
            if (smallest === uom) {
                break;
            }
            if (count > 0) {
                count++;
            }
            continue;
        }
        count++;
        elapsed -= inc * step;
        if (count === 3 || smallest === uom) {
            if (inc < BigInt(999) && (elapsed * BigInt(10)) / step >= BigInt(5)) {
                inc = inc + BigInt(1);
            }
        }
        res += inc + uom + ' ';
        if (smallest === uom) {
            break;
        }
    }
    return res || '0ms';
}
