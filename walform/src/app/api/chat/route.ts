import { createDeepSeek, type DeepSeekLanguageModelOptions } from '@ai-sdk/deepseek';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, generateText, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

// ── Chat rate limiter ──────────────────────────────────────────────────────────
const CHAT_RATE_LIMIT = 20;
const CHAT_RATE_WINDOW_MS = 60_000;
type RateEntry = { count: number; resetsAt: number };
const chatRateStore = (globalThis as typeof globalThis & { __chatRateStore?: Map<string, RateEntry> }).__chatRateStore ??= new Map();

function checkChatRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = chatRateStore.get(ip);
  if (!entry || entry.resetsAt <= now) {
    chatRateStore.set(ip, { count: 1, resetsAt: now + CHAT_RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= CHAT_RATE_LIMIT;
}

// ── Request schema ─────────────────────────────────────────────────────────────
const chatRequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
  memory: z.string().max(8000).optional(),
  appContext: z.object({
    wallet: z.object({
      connected: z.boolean(),
      address: z.string().nullable(),
      network: z.string(),
    }),
    route: z.string().optional(),
    activeFormId: z.string().nullable().optional(),
  }).optional(),
});

const openaiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const deepseekModel = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
const deepseekBaseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const deepseekMaxOutputTokens = 900;
const deepseekTemperature = 0.2;
const deepseekTopP = 0.9;
const deepseekTimeoutMs = 15000;
const deepseekContextMaxChars = 8000;
const deepseekThinkingEnabled = true;

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[truncated: ${value.length - maxChars} chars omitted]`;
}

function getDeepSeekProviderOptions() {
  return {
    deepseek: {
      thinking: { type: deepseekThinkingEnabled ? 'enabled' : 'disabled' },
    } satisfies DeepSeekLanguageModelOptions,
  };
}

function makeDeepSeekProvider() {
  return createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: deepseekBaseURL,
  });
}

const chatTools = {
  askDeepSeekDataAgent: tool({
    description: [
      'Delegate smaller read-only data analysis tasks to the DeepSeek subagent.',
      'Use this after wallet/read tool outputs need summarization, normalization, or lightweight on-chain/token/context analysis.',
      'Do not use it for wallet signing, private keys, transfer confirmation, swap execution, or final safety decisions.',
    ].join(' '),
    inputSchema: z.object({
      task: z.string().describe('The specific read-only analysis task for the DeepSeek subagent.'),
      context: z.string().describe('Relevant user request, session memory, and tool outputs to analyze.'),
    }),
    execute: async ({ task, context }) => {
      if (!process.env.DEEPSEEK_API_KEY) {
        return {
          ok: false,
          error: 'Missing DEEPSEEK_API_KEY. Add it to .env.local to enable the DeepSeek data subagent.',
        };
      }

      const result = await generateText({
        model: makeDeepSeekProvider()(deepseekModel),
        maxOutputTokens: deepseekMaxOutputTokens,
        temperature: deepseekTemperature,
        topP: deepseekTopP,
        timeout: { totalMs: deepseekTimeoutMs },
        providerOptions: getDeepSeekProviderOptions(),
        system: [
          'You are the WalForm DeepSeek data subagent.',
          'Handle only small read-only analysis tasks delegated by the main OpenAI agent.',
          'Analyze wallet/tool outputs, on-chain context, token balances, owned objects, WalForm portfolio data, and swap/token context.',
          'Never request seed phrases, private keys, wallet recovery secrets, or signatures.',
          'Never claim a transaction or swap was executed.',
          'Return concise JSON only with keys: summary, facts, risks, suggested_next_action.',
        ].join(' '),
        prompt: [
          `Task: ${task}`,
          '',
          'Context:',
          truncateText(context, deepseekContextMaxChars),
        ].join('\n'),
      });

      return {
        ok: true,
        data: result.text,
        agent: 'deepseek-data-agent',
        model: deepseekModel,
      };
    },
  }),
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
  getWalFormFormStats: tool({
    description: [
      'Resolve one owned WalForm form for the connected wallet and read form-level stats.',
      'Use this for questions about a specific form, a form title, current form page, latest form, created time, active status, or submission/response count.',
      'If multiple owned forms match the same title/reference, the tool returns match=multiple and candidates; ask the user to choose one.',
    ].join(' '),
    inputSchema: z.object({
      formReference: z.string().optional().describe('Form title, partial title, or form object ID. Omit to use current form page or latest owned form.'),
    }),
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

  const ip =
    (req.headers.get('x-forwarded-for') ?? '').split(',').at(-1)?.trim() ||
    (req.headers.get('x-real-ip') ?? 'unknown');
  if (!checkChatRateLimit(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, memory, appContext } = parsed.data as unknown as {
    messages: UIMessage[];
    memory?: string;
    appContext?: {
      wallet?: { connected?: boolean; address?: string | null; network?: string };
      route?: string;
      activeFormId?: string | null;
    };
  };
  const walletAddress = appContext?.wallet?.address ?? null;
  const walletContext = [
    'Current app context:',
    `- Connected wallet: ${walletAddress ? walletAddress : 'none'}`,
    `- Wallet connected: ${String(Boolean(appContext?.wallet?.connected && walletAddress))}`,
    `- Network: ${appContext?.wallet?.network ?? 'unknown'}`,
    `- Current route: ${appContext?.route ?? 'unknown'}`,
    `- Active form ID from route: ${appContext?.activeFormId ?? 'none'}`,
    'Default meaning: Vietnamese/English words like "tôi", "của tôi", "my", "me", and "wallet của tôi" refer to this connected wallet unless the user explicitly provides another wallet address.',
  ].join('\n');

  const result = streamText({
    model: openai(openaiModel),
    system: [
      'You are WalForm Assistant, a concise product guide embedded in the WalForm app.',
      'You are the main OpenAI agent: parse intent, decide which tools are needed, and synthesize the final answer.',
      'For smaller read-only data analysis tasks, delegate to askDeepSeekDataAgent and use its structured findings in your final response.',
      'Help users build forms, understand Walrus storage, Sui ownership, Seal encryption, and dashboard workflows.',
      'You can use wallet tools to read connected wallet information and on-chain data.',
      walletContext,
      'Answer in the same natural language the user uses. If they ask in Vietnamese, answer in Vietnamese. Keep answers human, concrete, and not robotic.',
      'For any user question about their forms, submissions, responses, admin caps, form IDs, latest form, recent form, or WalForm portfolio, call getWalFormPortfolio before answering unless the answer is already present in session memory.',
      'For questions about a specific form title/id, duplicate form names, form creation time, active status, or submission/response count, call getWalFormFormStats. If it returns match=multiple, do not choose randomly; ask the user to pick from the candidates with short IDs/created times.',
      'If the user asks about "form này" and active form ID is present in current app context, call getWalFormFormStats without formReference so the current form page can be used.',
      'When getWalFormPortfolio returns summary.latestOwnedForm, summary.latestReceivedSubmission, or summary.latestRecentTransaction, use those exact facts instead of only repeating counts.',
      'Interpret "form gần nhất tôi tạo/sở hữu" as latestOwnedForm. Interpret "response/submission gần nhất trên form của tôi" as latestReceivedSubmission.',
      'If the user asks "form gần nhất tôi submit" or similar, do not pretend the wallet portfolio can prove respondent history: WalForm submissions do not require a wallet. Ask whether they mean the latest form they own/created, or the latest response received on their forms. If latestReceivedSubmission exists, offer it as the closest available fact.',
      'If required data is missing or ambiguous, ask one concise clarifying question and mention what data is needed, rather than giving a vague answer.',
      'Distinguish fungible tokens from owned objects: use getCoinBalances for token/coin questions, and getOwnedObjects only for NFTs or object resources.',
      'Use askDeepSeekDataAgent after read-only tool outputs need summarization, normalization, or lightweight data lookup so the main OpenAI agent does less low-level analysis.',
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
