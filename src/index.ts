export * from './WebServer';
export * from './ContentTypes';
export * from './Core';
export * from './Routers';
export * from './Tools';

import * as WebServer from './WebServer';
import * as ContentTypes from './ContentTypes';
import * as Core from './Core';
import * as Routers from './Routers';
import * as Tools from './Tools';

export default {
    ...WebServer,
    ...ContentTypes,
    ...Core,
    ...Routers,
    ...Tools
}