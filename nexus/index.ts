/**
 * Nexus - 科研上下文中枢
 * 
 * Redigg 的"大脑"，管理全生命周期的科研信息
 */

export { Nexus, NexusConfig } from './core/nexus';
export { NexusIndexer } from './core/indexer';
export * from './core/models';
export { BaseConnector, ConnectorFetchResult, ConnectorConfig } from './connectors/base';
export { ZoteroConnector } from './connectors/zotero';
export { ObsidianConnector } from './connectors/obsidian';