import "./config.ts"; // Add this line first

import Database from "better-sqlite3";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { DirectClient } from "@realityspiral/client-direct";
import { TwitterClientInterface } from "@elizaos/client-twitter";
import { normalizeCharacter } from "@elizaos/plugin-di";
import {
  AgentRuntime,
  CacheManager,
  type Character,
  type Client,
  Clients,
  DbCacheAdapter,
  defaultCharacter,
  ModelProviderName,
  elizaLogger,
  type IAgentRuntime,
  type ICacheManager,
  type IDatabaseAdapter,
  type IDatabaseCacheAdapter,
  parseBooleanFromText,
  settings,
  stringToUuid,
  validateCharacterConfig,
} from "@elizaos/core";
import {
  advancedTradePlugin,
  coinbaseCommercePlugin,
  coinbaseMassPaymentsPlugin,
  tokenContractPlugin,
  tradePlugin,
  webhookPlugin,
} from "@realityspiral/plugin-coinbase";
import {
  githubInitializePlugin,
  githubCreateCommitPlugin,
  githubCreatePullRequestPlugin,
  githubCreateMemorizeFromFilesPlugin,
  githubCreateIssuePlugin,
  githubModifyIssuePlugin,
  githubIdeationPlugin,
  githubInteractWithPRPlugin,
  githubInteractWithIssuePlugin,
} from "@realityspiral/plugin-github";
import { GitHubClientInterface } from "@realityspiral/client-github";
import { CoinbaseClientInterface } from "@realityspiral/client-coinbase";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const logFetch = async (url: string, options: any) => {
  elizaLogger.debug(`Fetching ${url}`);
  // Disabled to avoid disclosure of sensitive information such as API keys
  // elizaLogger.debug(JSON.stringify(options, null, 2));
  return fetch(url, options);
};

export function parseArguments(): {
  character?: string;
  characters?: string;
} {
  try {
    return yargs(process.argv.slice(3))
      .option("character", {
        type: "string",
        description: "Path to the character JSON file",
      })
      .option("characters", {
        type: "string",
        description: "Comma separated list of paths to character JSON files",
      })
      .parseSync();
  } catch (error) {
    elizaLogger.error("Error parsing arguments:", error);
    return {};
  }
}

function tryLoadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return null;
  }
}
function mergeCharacters(base: Character, child: Character): Character {
  const mergeObjects = (baseObj: any, childObj: any) => {
    const result: any = {};
    const keys = new Set([
      ...Object.keys(baseObj || {}),
      ...Object.keys(childObj || {}),
    ]);
    keys.forEach((key) => {
      if (
        typeof baseObj[key] === "object" &&
        typeof childObj[key] === "object" &&
        !Array.isArray(baseObj[key]) &&
        !Array.isArray(childObj[key])
      ) {
        result[key] = mergeObjects(baseObj[key], childObj[key]);
      } else if (Array.isArray(baseObj[key]) || Array.isArray(childObj[key])) {
        result[key] = [...(baseObj[key] || []), ...(childObj[key] || [])];
      } else {
        result[key] =
          childObj[key] !== undefined ? childObj[key] : baseObj[key];
      }
    });
    return result;
  };
  return mergeObjects(base, child);
}

async function loadCharactersFromUrl(url: string): Promise<Character[]> {
  try {
    const response = await fetch(url);
    const responseJson = await response.json();

    let characters: Character[] = [];
    if (Array.isArray(responseJson)) {
      characters = await Promise.all(
        responseJson.map((character) => jsonToCharacter(url, character))
      );
    } else {
      const character = await jsonToCharacter(url, responseJson);
      characters.push(character);
    }
    return characters;
  } catch (e) {
    elizaLogger.error(`Error loading character(s) from ${url}: ${e}`);
    process.exit(1);
  }
}

async function jsonToCharacter(
  filePath: string,
  character: any
): Promise<Character> {
  validateCharacterConfig(character);

  // .id isn't really valid
  const characterId = character.id || character.name;
  const characterPrefix = `CHARACTER.${characterId
    .toUpperCase()
    .replace(/ /g, "_")}.`;
  const characterSettings = Object.entries(process.env)
    .filter(([key]) => key.startsWith(characterPrefix))
    .reduce((settings, [key, value]) => {
      const settingKey = key.slice(characterPrefix.length);
      return { ...settings, [settingKey]: value };
    }, {});
  if (Object.keys(characterSettings).length > 0) {
    character.settings = character.settings || {};
    character.settings.secrets = {
      ...characterSettings,
      ...character.settings.secrets,
    };
  }
  // Handle plugins
  character.plugins = await handlePluginImporting(character.plugins);
  if (character.extends) {
    elizaLogger.info(
      `Merging  ${character.name} character with parent characters`
    );
    for (const extendPath of character.extends) {
      const baseCharacter = await loadCharacter(
        path.resolve(path.dirname(filePath), extendPath)
      );
      character = mergeCharacters(baseCharacter, character);
      elizaLogger.info(`Merged ${character.name} with ${baseCharacter.name}`);
    }
  }
  return character;
}

async function loadCharacter(filePath: string): Promise<Character> {
  const content = tryLoadFile(filePath);
  if (!content) {
    throw new Error(`Character file not found: ${filePath}`);
  }
  const character = JSON.parse(content);
  return jsonToCharacter(filePath, character);
}

async function loadCharacterTryPath(characterPath: string): Promise<Character> {
  let content: string | null = null;
  let resolvedPath = "";

  // Try different path resolutions in order
  const pathsToTry = [
    characterPath, // exact path as specified
    path.resolve(process.cwd(), characterPath), // relative to cwd
    path.resolve(process.cwd(), "agent", characterPath), // Add this
    path.resolve(__dirname, characterPath), // relative to current script
    path.resolve(__dirname, "characters", path.basename(characterPath)), // relative to agent/characters
    path.resolve(__dirname, "../characters", path.basename(characterPath)), // relative to characters dir from agent
    path.resolve(__dirname, "../../characters", path.basename(characterPath)), // relative to project root characters dir
  ];

  elizaLogger.info(
    "Trying paths:",
    pathsToTry.map((p) => ({
      path: p,
      exists: fs.existsSync(p),
    }))
  );

  for (const tryPath of pathsToTry) {
    content = tryLoadFile(tryPath);
    if (content !== null) {
      resolvedPath = tryPath;
      break;
    }
  }

  if (content === null) {
    elizaLogger.error(
      `Error loading character from ${characterPath}: File not found in any of the expected locations`
    );
    elizaLogger.error("Tried the following paths:");
    pathsToTry.forEach((p) => elizaLogger.error(` - ${p}`));
    throw new Error(
      `Error loading character from ${characterPath}: File not found in any of the expected locations`
    );
  }
  try {
    const character: Character = await loadCharacter(resolvedPath);
    elizaLogger.info(`Successfully loaded character from: ${resolvedPath}`);
    return character;
  } catch (e) {
    elizaLogger.error(`Error parsing character from ${resolvedPath}: ${e}`);
    throw new Error(`Error parsing character from ${resolvedPath}: ${e}`);
  }
}

function commaSeparatedStringToArray(commaSeparated: string): string[] {
  return commaSeparated?.split(",").map((value) => value.trim());
}

async function readCharactersFromStorage(
  characterPaths: string[]
): Promise<string[]> {
  try {
    const uploadDir = path.join(process.cwd(), "data", "characters");
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const fileNames = await fs.promises.readdir(uploadDir);
    fileNames.forEach((fileName) => {
      characterPaths.push(path.join(uploadDir, fileName));
    });
  } catch (err) {
    elizaLogger.error(`Error reading directory: ${err.message}`);
  }

  return characterPaths;
}

export async function loadCharacters(charactersArg: string): Promise<Character[]> {
  let characterPaths = commaSeparatedStringToArray(charactersArg);

  if (process.env.USE_CHARACTER_STORAGE === "true") {
    characterPaths = await readCharactersFromStorage(characterPaths);
  }

  const loadedCharacters: Character[] = [];

  if (characterPaths?.length > 0) {
    for (const characterPath of characterPaths) {
      try {
        const character: Character = await loadCharacterTryPath(characterPath);
        loadedCharacters.push(character);
      } catch (e) {
        process.exit(1);
      }
    }
  }

  if (hasValidRemoteUrls()) {
    elizaLogger.info("Loading characters from remote URLs");
    const characterUrls = commaSeparatedStringToArray(
      process.env.REMOTE_CHARACTER_URLS
    );
    for (const characterUrl of characterUrls) {
      const characters = await loadCharactersFromUrl(characterUrl);
      loadedCharacters.push(...characters);
    }
  }

  if (loadedCharacters.length === 0) {
    elizaLogger.info("No characters found, using default character");
    loadedCharacters.push(defaultCharacter);
  }

  return loadedCharacters;
}

async function handlePluginImporting(plugins: string[]) {
  if (plugins.length > 0) {
    elizaLogger.info("Plugins are: ", plugins);
    const importedPlugins = await Promise.all(
      plugins.map(async (plugin) => {
        try {
          const importedPlugin = await import(plugin);
          const functionName =
            plugin
              .replace("@realityspiral/plugin-", "")
              .replace(/-./g, (x) => x[1].toUpperCase()) + "Plugin"; // Assumes plugin function is camelCased with Plugin suffix
          return importedPlugin.default || importedPlugin[functionName];
        } catch (importError) {
          elizaLogger.error(`Failed to import plugin: ${plugin}`, importError);
          return []; // Return null for failed imports
        }
      })
    );
    return importedPlugins;
  } else {
    return [];
  }
}

export function getTokenForProvider(
  provider: ModelProviderName,
  character: Character
): string | undefined {
  switch (provider) {
    case ModelProviderName.OPENAI:
      return (
        character.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY
      );
    default:
      const errorMessage = `Failed to get token - unsupported model provider: ${provider}`;
      elizaLogger.error(errorMessage);
      throw new Error(errorMessage);
  }
}

function initializeDatabase(dataDir: string) {
  const filePath =
    process.env.SQLITE_FILE ?? path.resolve(dataDir, "db.sqlite");
  elizaLogger.info(`Initializing SQLite database at ${filePath}...`);
  const db = new SqliteDatabaseAdapter(new Database(filePath));

  // Test the connection
  db.init()
    .then(() => {
      elizaLogger.success("Successfully connected to SQLite database");
    })
    .catch((error) => {
      elizaLogger.error("Failed to connect to SQLite:", error);
    });

  return db;
}

// also adds plugins from character file into the runtime
export async function initializeClients(character: Character, runtime: IAgentRuntime) {
  // each client can only register once
  // and if we want two we can explicitly support it
  const clients: Record<string, any> = {};
  const clientTypes: string[] =
    character.clients?.map((str) => str.toLowerCase()) || [];
  elizaLogger.log("initializeClients", clientTypes, "for", character.name);

  if (clientTypes.includes(Clients.TWITTER)) {
    const twitterClient = await TwitterClientInterface.start(runtime);
    if (twitterClient) {
      clients.twitter = twitterClient;
    }
  }

  if (clientTypes.includes("coinbase")) {
    const coinbaseClient = await CoinbaseClientInterface.start(runtime);
    if (coinbaseClient) clients.coinbase = coinbaseClient;
  }

  if (clientTypes.includes("github")) {
    const githubClient = await GitHubClientInterface.start(runtime);
    if (githubClient) clients.github = githubClient;
  }

  elizaLogger.log("client keys", Object.keys(clients));

  function determineClientType(client: Client): string {
    // Check if client has a direct type identifier
    if ("type" in client) {
      return (client as any).type;
    }

    // Check constructor name
    const constructorName = client.constructor?.name;
    if (constructorName && !constructorName.includes("Object")) {
      return constructorName.toLowerCase().replace("client", "");
    }

    // Fallback: Generate a unique identifier
    return `client_${Date.now()}`;
  }

  if (character.plugins?.length > 0) {
    for (const plugin of character.plugins) {
      if (plugin.clients) {
        for (const client of plugin.clients) {
          const startedClient = await client.start(runtime);
          const clientType = determineClientType(client);
          elizaLogger.debug(`Initializing client of type: ${clientType}`);
          clients[clientType] = startedClient;
        }
      }
    }
  }

  return clients;
}

function getSecret(character: Character, secret: string) {
  return character.settings?.secrets?.[secret] || process.env[secret];
}

export async function createAgent(
  character: Character,
  db: IDatabaseAdapter,
  cache: ICacheManager,
  token: string
): Promise<AgentRuntime> {
  elizaLogger.log(`Creating runtime for character ${character.name}`);

  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    // character.plugins are handled when clients are added
    plugins: [
      getSecret(character, "COINBASE_COMMERCE_KEY")
        ? coinbaseCommercePlugin
        : null,
      ...(getSecret(character, "COINBASE_API_KEY") &&
      getSecret(character, "COINBASE_PRIVATE_KEY")
        ? [
            coinbaseMassPaymentsPlugin,
            tradePlugin,
            tokenContractPlugin,
            advancedTradePlugin,
          ]
        : []),
      getSecret(character, "COINBASE_API_KEY") &&
      getSecret(character, "COINBASE_PRIVATE_KEY") &&
      getSecret(character, "COINBASE_NOTIFICATION_URI")
        ? webhookPlugin
        : null,
      ...(getSecret(character, "GITHUB_PLUGIN_ENABLED") === "true" &&
      getSecret(character, "GITHUB_API_TOKEN")
        ? [
            githubInitializePlugin,
            githubCreateCommitPlugin,
            githubCreatePullRequestPlugin,
            githubCreateMemorizeFromFilesPlugin,
            githubCreateIssuePlugin,
            githubModifyIssuePlugin,
            githubIdeationPlugin,
            githubInteractWithIssuePlugin,
            githubInteractWithPRPlugin,
          ]
        : []),
    ]
      .flat()
      .filter(Boolean),
    providers: [],
    managers: [],
    cacheManager: cache,
    fetch: logFetch,
  });
}

function initializeDbCache(character: Character, db: IDatabaseCacheAdapter) {
  if (!character?.id) {
    throw new Error(
      "initializeFsCache requires id to be set in character definition"
    );
  }
  const cache = new CacheManager(new DbCacheAdapter(db, character.id));
  return cache;
}

async function startAgent(
  character: Character,
  directClient: DirectClient
): Promise<AgentRuntime> {
  let db: IDatabaseAdapter & IDatabaseCacheAdapter;
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getTokenForProvider(character.modelProvider, character);
    const dataDir = path.join(__dirname, "../data");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = initializeDatabase(dataDir) as IDatabaseAdapter &
      IDatabaseCacheAdapter;

    await db.init();

    const cache = initializeDbCache(character, db);

    const runtime: AgentRuntime = await createAgent(
      character,
      db,
      cache,
      token
    );

    // start services/plugins/process knowledge
    await runtime.initialize();

    // start assigned clients
    runtime.clients = await initializeClients(character, runtime);

    // add to container
    directClient.registerAgent(runtime);

    // report to console
    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

    return runtime;
  } catch (error) {
    elizaLogger.error(
      `Error starting agent for character ${character.name}:`,
      error
    );
    elizaLogger.error(error);
    if (db) {
      await db.close();
    }
    throw error;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

const hasValidRemoteUrls = () =>
  process.env.REMOTE_CHARACTER_URLS &&
  process.env.REMOTE_CHARACTER_URLS !== "" &&
  process.env.REMOTE_CHARACTER_URLS.startsWith("http");

const startAgents = async () => {
  // print process.env.CHARACTER
  elizaLogger.log("process.env.CHARACTER", process.env.CHARACTER);
  const directClient = new DirectClient();
  let serverPort = Number.parseInt(settings.SERVER_PORT || "3000");
  const args = parseArguments();
  const charactersArg =
    args.characters ||
    args.character ||
    process.env.CHARACTERS ||
    process.env.CHARACTER;
  let characters = [defaultCharacter];

  if (charactersArg || hasValidRemoteUrls()) {
    characters = await loadCharacters(charactersArg);
  }

  // Normalize characters for injectable plugins
  characters = await Promise.all(characters.map(normalizeCharacter));

  try {
    for (const character of characters) {
      await startAgent(character, directClient);
    }
  } catch (error) {
    elizaLogger.error("Error starting agents:", error);
  }

  // Find available port
  while (!(await checkPortAvailable(serverPort))) {
    elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
    serverPort++;
  }

  // upload some agent functionality into directClient
  directClient.startAgent = async (character) => {
    // Handle plugins
    character.plugins = await handlePluginImporting(character.plugins);

    // wrap it so we don't have to inject directClient later
    return startAgent(character, directClient);
  };

  directClient.loadCharacterTryPath = loadCharacterTryPath;
  directClient.jsonToCharacter = jsonToCharacter;

  directClient.start(serverPort);

  if (serverPort !== Number.parseInt(settings.SERVER_PORT || "3000")) {
    elizaLogger.log(`Server started on alternate port ${serverPort}`);
  }

  elizaLogger.log(
    "Run `pnpm start:client` to start the client and visit the outputted URL (http://localhost:5173) to chat with your agents. When running multiple agents, use client with different port `SERVER_PORT=3001 pnpm start:client`"
  );
};

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});

// Prevent unhandled exceptions from crashing the process if desired
if (
  process.env.PREVENT_UNHANDLED_EXIT &&
  parseBooleanFromText(process.env.PREVENT_UNHANDLED_EXIT)
) {
  // Handle uncaught exceptions to prevent the process from crashing
  process.on("uncaughtException", function (err) {
    console.error("uncaughtException", err);
  });

  // Handle unhandled rejections to prevent the process from crashing
  process.on("unhandledRejection", function (err) {
    console.error("unhandledRejection", err);
  });
}
