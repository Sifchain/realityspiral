# @realityspiral/client-oasis

This client orchestrates interactions with several Reality Spiral plugins:

*   `@realityspiral/plugin-rofl`: For creating Oasis wallets.
*   `@realityspiral/plugin-accumulated-finance`: For accumulated finance actions.
*   `@realityspiral/plugin-bitprotocol`: For BitProtocol actions.
*   `@realityspiral/plugin-neby`: For Neby actions.
*   `@realityspiral/plugin-thorn`: For Thorn actions.

## Usage

```typescript
// TODO: Add usage example
import { OasisClient } from '@realityspiral/client-oasis';

const client = new OasisClient(/* config */);

async function main() {
  const result = await client.initializeAndExecute();
  console.log(result);
}

main();
```

## Development

*   Build: `npm run build`
*   Develop: `npm run dev` 