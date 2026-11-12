import './build-domain.mjs';
import {installAccountRuntime,installDomain} from '@garden/account/build';
await installAccountRuntime(new URL('../web/app/',import.meta.url));
await installDomain(new URL('../domain/',import.meta.url),new URL('../web/domain/',import.meta.url));
