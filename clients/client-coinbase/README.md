# @elizaos/client-coinbase

Coinbase client for ElizaOS that handles trading signals via webhooks.

## Testing

You can test the Coinbase client webhook endpoints using the following curl commands:

### Test Buy Signal

```bash
curl -X POST http://localhost:3000/webhook/coinbase/94518332-6d84-0df9-b71b-3de37d3976a5 \
     -H "Content-Type: application/json" \
     -d "{
           \"event\": \"buy\",
           \"ticker\": \"BTC\",
           \"timestamp\": $(python3 -c 'import time; print(int(time.time() * 1000))'),
           \"price\": $(curl -s -X GET "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" -H "accept: application/json" | jq .bitcoin.usd)
         }"
```

### Test Sell Signal

```bash
curl -X POST http://localhost:3000/webhook/coinbase/94518332-6d84-0df9-b71b-3de37d3976a5 \
     -H "Content-Type: application/json" \
     -d "{
           \"event\": \"sell\",
           \"ticker\": \"BTC\",
           \"timestamp\": $(python3 -c 'import time; print(int(time.time() * 1000))'),
           \"price\": $(curl -s -X GET "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" -H "accept: application/json" | jq .bitcoin.usd)
         }"
```
