import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const chatTools = {
  getWalletInfo: tool({
    description: 'Read the connected Sui wallet address and selected app network. Use when the user asks about their wallet connection or address.',
    inputSchema: z.object({}),
  }),
  getSuiBalance: tool({
    description: 'Read the connected wallet balance for SUI or another Sui coin type. Use SUI by default.',
    inputSchema: z.object({
      coinType: z.string().default('0x2::sui::SUI').describe('Sui coin type, e.g. 0x2::sui::SUI.'),
    }),
  }),
  getCoinBalances: tool({
    description: 'Read all fungible coin/token balances in the connected wallet. Use this for questions like "any other token?", "what tokens do I have?", or "list my coin balances".',
    inputSchema: z.object({}),
  }),
  getOwnedObjects: tool({
    description: 'Read NFT/object resources owned by the connected wallet, such as NFTs, AdminCap, Form objects, StakedWal, and other non-fungible Sui objects. Do not use this for token or coin balance questions.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(20),
    }),
  }),
  getWalFormPortfolio: tool({
    description: 'Read WalForm-specific on-chain data for the connected wallet: owned forms, admin caps, and recent transactions.',
    inputSchema: z.object({}),
  }),
  proposeTransferSui: tool({
    description: 'Create a SUI transfer proposal. This must never execute automatically; the UI will ask the user to review and sign in their wallet.',
    inputSchema: z.object({
      recipient: z.string().describe('Recipient Sui address.'),
      amountSui: z.string().describe('Amount in SUI, not MIST. Example: "0.1".'),
    }),
  }),
  proposeTransferSuiMany: tool({
    description: 'Create one Programmable Transaction Block proposal that transfers SUI to multiple recipients. This must never execute automatically; the UI will ask the user to review and sign in their wallet.',
    inputSchema: z.object({
      recipients: z.array(z.object({
        recipient: z.string().describe('Recipient Sui address.'),
        amountSui: z.string().describe('Amount in SUI, not MIST. Example: "0.1".'),
      })).min(2).max(16),
    }),
  }),
  proposeTransferObject: tool({
    description: 'Create an NFT/object transfer proposal for a specific owned Sui object ID. Use this for NFT transfer requests. This must never execute automatically; the UI will ask the user to review and sign in their wallet.',
    inputSchema: z.object({
      objectId: z.string().describe('Sui object ID or NFT object ID to transfer.'),
      recipient: z.string().describe('Recipient Sui address.'),
    }),
  }),
  proposeBatchTransfer: tool({
    description: 'Create a single Programmable Transaction Block (PTB) that transfers SUI coins AND/OR one or more NFT/objects to the same recipient in one wallet signature. Use this when the user wants to send both SUI and objects (or multiple objects) to the same address in one transaction. This must never execute automatically; the UI will ask the user to review and sign.',
    inputSchema: z.object({
      recipient: z.string().describe('Recipient Sui address.'),
      amountSui: z.string().optional().describe('SUI amount to include, e.g. "0.1". Omit if no SUI transfer.'),
      objectIds: z.array(z.string()).min(1).describe('List of Sui object IDs (NFTs, objects) to transfer.'),
    }),
  }),
  proposeSwap: tool({
    description: 'Create a swap proposal through the configured Sui swap provider. This must never execute automatically; the UI will ask the user to review and sign in their wallet.',
    inputSchema: z.object({
      coinInType: z.string().describe('Input Sui coin type.'),
      coinOutType: z.string().describe('Output Sui coin type.'),
      amountIn: z.string().describe('Input amount in raw base units for the input coin.'),
      slippage: z.number().positive().max(0.5).default(0.01).describe('Slippage as decimal, e.g. 0.01 for 1%.'),
    }),
  }),
};

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'Missing OPENAI_API_KEY. Add it to .env.local to enable AI chat.' },
      { status: 500 },
    );
  }

  const {
    messages,
    memory,
  }: {
    messages: UIMessage[];
    memory?: string;
  } = await req.json();

  const result = streamText({
    model: openai(model),
    system: [
      'You are WalForm Assistant, a concise product guide embedded in the WalForm app.',
      'Help users build forms, understand Walrus storage, Sui ownership, Seal encryption, and dashboard workflows.',
      'You can use wallet tools to read connected wallet information and on-chain data.',
      'Distinguish fungible tokens from owned objects: use getCoinBalances for token/coin questions, and getOwnedObjects only for NFTs or object resources.',
      'For transfer and swap requests, only create a proposal. Never claim a transaction was executed unless the UI reports a transaction digest.',
      'Use proposeTransferSuiMany when the user asks to send SUI to multiple wallet addresses in one transaction.',
      'Use proposeBatchTransfer when the user wants to send BOTH SUI and objects/NFTs to the SAME address in one transaction — this produces a single PTB and requires only one wallet signature.',
      'Use proposeTransferObject only when the user wants to transfer a single object with no SUI to the same recipient.',
      'Never ask for or accept seed phrases, private keys, or wallet recovery secrets.',
      'If a user asks for unsupported or unsafe actions, refuse briefly and redirect to safe guidance.',
      memory
        ? `Session memory from recent turns and tool outputs:\n${memory}`
        : '',
    ].join(' '),
    tools: chatTools,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
