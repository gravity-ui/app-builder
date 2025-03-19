import { ControllableScript } from '../../common/child-process/controllable-script';
import type { NormalizedServiceConfig } from '../../common/models';
export declare function watchServerCompilation(config: NormalizedServiceConfig): Promise<ControllableScript>;
