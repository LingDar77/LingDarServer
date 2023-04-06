export * from './WebServer';
export * from './ContentTypes';
export * from './Core';
export * from './Routers';

import * as WebServer from './WebServer';
import * as ContentTypes from './ContentTypes';
import * as Core from './Core';
import * as Routers from './Routers';

export default {
    ...WebServer,
    ...ContentTypes,
    ...Core,
    ...Routers,
};