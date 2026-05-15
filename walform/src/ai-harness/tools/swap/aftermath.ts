import { Aftermath } from 'aftermath-ts-sdk';

import type { HarnessNetwork, SwapProvider, SwapProposal, SwapQuoteInput } from '../../types';

const ZERO = BigInt(0);
const TEN_THOUSAND = BigInt(10_000);
const routers = new Map<HarnessNetwork, Promise<ReturnType<Aftermath['Router']>>>();

function makeProposalId() {
  return `swap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toAftermathNetwork(network: HarnessNetwork) {
  return network === 'mainnet' ? 'MAINNET' : 'TESTNET';
}

function assertMainnet(network: HarnessNetwork) {
  if (network !== 'mainnet') {
    throw new Error('Swap unavailable on this network. Aftermath Router swaps are enabled for mainnet only in this harness.');
  }
}

async function getRouter(network: HarnessNetwork) {
  assertMainnet(network);

  let routerPromise = routers.get(network);
  if (!routerPromise) {
    routerPromise = (async () => {
      const af = new Aftermath(toAftermathNetwork(network));
      await af.init();
      return af.Router();
    })();
    routers.set(network, routerPromise);
  }
  return routerPromise;
}

function estimateMinAmountOut(amountOut: string, slippage: number) {
  const basisPoints = BigInt(Math.round(slippage * 10_000));
  const safeBps = basisPoints > TEN_THOUSAND ? TEN_THOUSAND : basisPoints;
  return ((BigInt(amountOut) * (TEN_THOUSAND - safeBps)) / TEN_THOUSAND).toString();
}

export const aftermathSwapProvider: SwapProvider = {
  async quote(input: SwapQuoteInput): Promise<SwapProposal> {
    if (!/^\d+$/.test(input.amountIn) || BigInt(input.amountIn) <= ZERO) {
      throw new Error('Swap amountIn must be a positive integer in raw coin units.');
    }
    if (input.slippage <= 0 || input.slippage > 0.5) {
      throw new Error('Slippage must be greater than 0 and at most 0.5. Use 0.01 for 1%.');
    }

    const router = await getRouter(input.network);
    const route = await router.getCompleteTradeRouteGivenAmountIn({
      coinInType: input.coinInType,
      coinOutType: input.coinOutType,
      coinInAmount: BigInt(input.amountIn),
    });

    const expectedAmountOut = String(route.coinOut.amount);

    return {
      kind: 'swap',
      id: makeProposalId(),
      provider: 'aftermath',
      coinInType: input.coinInType,
      coinOutType: input.coinOutType,
      amountIn: input.amountIn,
      expectedAmountOut,
      minAmountOut: estimateMinAmountOut(expectedAmountOut, input.slippage),
      slippage: input.slippage,
      network: input.network,
      route,
      summary: `Swap ${input.amountIn} units of ${input.coinInType} to about ${expectedAmountOut} units of ${input.coinOutType}`,
    };
  },

  async buildTransaction(proposal: SwapProposal, walletAddress: string) {
    const router = await getRouter(proposal.network);
    return router.getTransactionForCompleteTradeRoute({
      walletAddress,
      completeRoute: proposal.route,
      slippage: proposal.slippage,
    });
  },
};
