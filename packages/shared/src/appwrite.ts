import { Account, Client, ID, TablesDB } from "appwrite";

export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
  foldersCollectionId: string;
  bookmarksCollectionId: string;
}

export interface AppwriteServices {
  client: Client;
  account: Account;
  tables: TablesDB;
  config: AppwriteConfig;
}

export function createAppwriteClient(config: AppwriteConfig): AppwriteServices {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);

  return {
    client,
    account: new Account(client),
    tables: new TablesDB(client),
    config,
  };
}

export function isAppwriteConfigComplete(
  config: Partial<AppwriteConfig>,
): config is AppwriteConfig {
  return Boolean(
    config.endpoint &&
      config.projectId &&
      config.databaseId &&
      config.foldersCollectionId &&
      config.bookmarksCollectionId,
  );
}

export { ID };
