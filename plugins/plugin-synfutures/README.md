# SynFutures Perpetual Trading Utilities

This utility library provides a simplified interface for interacting with SynFutures Perpetual contracts on the Base network. It abstracts away much of the complexity of the underlying SynFutures Perp SDK and makes common operations like placing orders, managing positions, and providing liquidity more accessible.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Core Functions](#core-functions)
  - [Market Operations](#market-operations)
  - [Position Management](#position-management)
  - [Limit Orders](#limit-orders)
  - [Liquidity Management](#liquidity-management)
- [API Reference](#api-reference)
- [SynFutures Perp System Design](#synfutures-perp-system-design)
- [Troubleshooting](#troubleshooting)

## Overview

SynFutures@v3 delivers the first implementation of Oyster AMM for the derivatives market, offering permissionless creation of trading pairs with proper price feeds. The `perpUtils.ts` module provides utility functions for interacting with the core components of this system:

- **Instrument Contracts**: Core contracts for trading operations, limit orders, and liquidity management
- **Gate Contracts**: Manage margin transfers in/out of the system
- **Observer**: Query protocol data (instruments, portfolios, etc.)
- **Simulate**: Pre-operation simulation for better user experience

## Installation

```bash
npm install @synfutures/sdks-perp ethers@5.7.2 @derivation-tech/context @derivation-tech/tx-plugin dotenv
```

## Configuration

Create a `.env` file in your project root with the following variables:

```
BASE_RPC_URL="https://mainnet.base.org"  # Or your preferred RPC endpoint
PRIVATE_KEY="your_private_key_here"      # For signing transactions
```

## Usage

Import the needed functions from perpUtils:

```typescript
import {
  initContext,
  getInstrumentBySymbol,
  getAllInstruments,
  getPortfolio,
  depositToGate,
  withdrawFromGate,
  placeMarketOrder,
  closePosition,
  placeLimitOrder,
  // ... other functions as needed
} from "./path/to/perpUtils";
import { Side } from "@synfutures/sdks-perp";
import { ethers } from "ethers";
```

### Core Functions

```typescript
// Initialize the context (required before any other operations)
await initContext();

// Get all available instruments
const instruments = await getAllInstruments();

// Get a specific instrument by symbol
const instrument = await getInstrumentBySymbol("BTC-USDC-LINK");

// Get portfolio information
const portfolio = await getPortfolio(
  "0xYourAddress", 
  "0xInstrumentAddress", 
  4294967295 // PERP_EXPIRY (type(uint32).max)
);
```

### Market Operations

```typescript
// Set up a signer
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Deposit tokens to Gate
await depositToGate("USDC", "100", signer);

// Place a LONG market order
await placeMarketOrder(
  "BTC-USDC-LINK", // instrument symbol
  Side.LONG,      // order side (LONG or SHORT)
  "50",           // quote amount (in USDC)
  "10",           // leverage
  signer          // wallet for signing
);

// Close a position
await closePosition("BTC-USDC-LINK", signer);

// Withdraw tokens from Gate
await withdrawFromGate("USDC", "50", signer);
```

### Position Management

```typescript
// Adjust position leverage
await adjustPositionLeverage(
  "BTC-USDC-LINK", // instrument symbol
  "5",             // new leverage
  signer           // wallet for signing
);

// Adjust position margin (positive to add, negative to remove)
await adjustPositionMargin(
  "BTC-USDC-LINK", // instrument symbol
  "10",            // amount to add
  signer           // wallet for signing
);
```

### Limit Orders

```typescript
// Place a limit order
await placeLimitOrder(
  "ETH-USDC-LINK", // instrument symbol
  Side.SHORT,     // order side (LONG or SHORT)
  "50",           // quote amount (in USDC)
  "5",            // leverage
  100,            // tick offset (positive = higher price, negative = lower price)
  signer          // wallet for signing
);

// Cancel a specific limit order
await cancelLimitOrder(
  "ETH-USDC-LINK", // instrument symbol
  6520,            // tick of the order
  signer           // wallet for signing
);

// Place multiple scaled limit orders
await placeBatchScaledLimitOrders(
  "ETH-USDC-LINK",               // instrument symbol
  Side.SHORT,                   // order side
  "200",                        // total quote amount
  "5",                          // leverage
  0,                            // lower tick offset
  200,                          // upper tick offset
  5,                            // number of orders
  BatchOrderSizeDistribution.FLAT, // distribution pattern
  signer                        // wallet for signing
);

// Cancel all limit orders
await cancelAllLimitOrders("ETH-USDC-LINK", signer);
```

### Liquidity Management

```typescript
// Add liquidity
await addLiquidity(
  "BTC-USDC-LINK", // instrument symbol
  "200",           // margin amount
  "1.5",           // alpha factor (price range factor)
  signer           // wallet for signing
);

// Remove liquidity
await removeLiquidity(
  "BTC-USDC-LINK", // instrument symbol
  6400,            // lower tick
  6600,            // upper tick
  signer           // wallet for signing
);
```

## API Reference

### Initialization

- **`initContext()`**: Initialize the SynFutures Perp context

### Data Retrieval

- **`getAllInstruments()`**: Get all available instruments
- **`getInstrumentBySymbol(symbol: string)`**: Get a specific instrument by symbol
- **`getPortfolio(traderAddr: string, instrumentAddr: string, expiry: number)`**: Get portfolio information

### Margin Management

- **`depositToGate(tokenSymbol: string, amount: string, signer: ethers.Wallet)`**: Deposit tokens to Gate
- **`withdrawFromGate(tokenSymbol: string, amount: string, signer: ethers.Wallet)`**: Withdraw tokens from Gate

### Trading Operations

- **`placeMarketOrder(instrumentSymbol: string, side: Side, quoteAmount: string, leverage: string, signer: ethers.Wallet)`**: Place a market order
- **`closePosition(instrumentSymbol: string, signer: ethers.Wallet)`**: Close an existing position
- **`placeLimitOrder(instrumentSymbol: string, side: Side, quoteAmount: string, leverage: string, tickOffset: number, signer: ethers.Wallet)`**: Place a limit order
- **`cancelLimitOrder(instrumentSymbol: string, tick: number, signer: ethers.Wallet)`**: Cancel a limit order
- **`placeBatchScaledLimitOrders(...)`**: Place multiple scaled limit orders
- **`cancelAllLimitOrders(instrumentSymbol: string, signer: ethers.Wallet)`**: Cancel all limit orders
- **`placeCrossMarketOrder(...)`**: Place a cross market order (market + limit)

### Position Management

- **`adjustPositionLeverage(instrumentSymbol: string, newLeverage: string, signer: ethers.Wallet)`**: Adjust position leverage
- **`adjustPositionMargin(instrumentSymbol: string, marginAmount: string, signer: ethers.Wallet)`**: Adjust position margin

### Liquidity Management

- **`addLiquidity(instrumentSymbol: string, marginAmount: string, alphaFactor: string, signer: ethers.Wallet)`**: Add liquidity
- **`removeLiquidity(instrumentSymbol: string, tickLower: number, tickUpper: number, signer: ethers.Wallet)`**: Remove liquidity

## SynFutures Perp System Design

SynFutures@v3 delivers the Oyster AMM for the derivatives market with the following key components:

### Architecture
- **Instrument Contract**: Core contract for trading operations, limit orders, and liquidity management
- **Gate Contract**: Margin center that handles all token transfers in/out of the system
- **Config Contract**: Manages parameters for supported markets and quotes
- **Observer**: Utility for querying protocol data like instrument details and portfolio information

### Key Features
- Supports both perpetual futures (identified by `type(uint32).max`) and dated futures
- Multiple price feeder support: CHAINLINK, Pyth, Uniswap V2 style DEX
- Risk isolation between different instruments and pairs
- Gas-efficient design without router pattern

### Trading Operations
- Market orders: Immediate execution at current market price
- Limit orders: Execution only when price reaches specified level
- Cross-market orders: Combination of market and limit orders
- Position management: Adjust leverage/margin, close positions

### Liquidity Management
- Add liquidity: Contribute to the AMM liquidity pool
- Add asymmetric liquidity: Contribute with custom price ranges
- Remove liquidity: Withdraw from the liquidity pool

### Risk Management
- Each instrument has isolated margin and risk
- Positions are managed with appropriately calculated maintenance margin requirements
- Liquidation process is triggered automatically when position margin falls below maintenance requirements

## Troubleshooting

### Common Issues

1. **RPC Connection Errors**
   - Ensure your BASE_RPC_URL is correct and the endpoint is accessible
   - Try using a different RPC provider if persistent issues occur

2. **Insufficient Funds**
   - Check your wallet balance for the required tokens
   - Ensure you've approved the Gate contract to use your tokens

3. **Transaction Failures**
   - Check the slippage settings (default is 1%)
   - For high-volatility pairs, you may need to increase slippage tolerance
   - Ensure your position size meets minimum requirements

4. **Position Not Found**
   - Verify you're using the correct instrument symbol
   - Check that you have an active position before attempting to modify or close

For more detailed troubleshooting, refer to the [SynFutures documentation](https://docs.synfutures.com/). 