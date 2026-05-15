'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import {
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Database,
  FileKey2,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Send,
  ShieldCheck,
  Square,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  aftermathSwapProvider,
  buildBatchTransferTx,
  buildTransferObjectTx,
  buildTransferSuiManyTx,
  buildTransferSuiTx,
  createBatchTransferProposal,
  createTransferObjectProposal,
  createTransferSuiManyProposal,
  createTransferSuiProposal,
  getCoinBalances,
  getOwnedObjectSummaries,
  getSuiBalance,
  getWalletInfo,
  getWalFormPortfolio,
  type BatchTransferProposal,
  type HarnessNetwork,
  type SwapProposal,
  type TransactionProposal,
  type TransferObjectProposal,
  type TransferSuiManyProposal,
  type TransferSuiProposal,
} from '@/ai-harness';
import { SUI_NETWORK } from '@/lib/constants';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'What wallet is connected?',
  'What is my SUI balance?',
  'Show my WalForm portfolio.',
];

type ChatToolCall = {
  dynamic?: boolean;
  toolName: string;
  toolCallId: string;
  input: unknown;
};

type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
};

function getText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function isProposal(value: unknown): value is TransactionProposal {
  const record = asRecord(value);
  return ['transfer_sui', 'transfer_sui_many', 'transfer_object', 'batch_transfer', 'swap'].includes(String(record.kind));
}

function unwrapProposal(output: unknown): TransactionProposal | null {
  const record = asRecord(output);
  if (record.ok === true && isProposal(record.data)) return record.data;
  if (isProposal(output)) return output;
  return null;
}

function toolNameFromPart(part: ToolPart) {
  return part.type.replace('tool-', '');
}

function toolData(part: ToolPart) {
  const output = asRecord(part.output);
  return output.ok === true ? output.data : part.output;
}

function hasRenderableDataTool(message: UIMessage) {
  return message.parts.some((part) => {
    if (!part.type.startsWith('tool-')) return false;
    const toolName = part.type.replace('tool-', '');
    return ['getWalletInfo', 'getSuiBalance', 'getCoinBalances', 'getOwnedObjects', 'getWalFormPortfolio'].includes(toolName);
  });
}

function summarizeToolPart(part: ToolPart) {
  if (part.state !== 'output-available') return null;

  const name = toolNameFromPart(part);
  const data = asRecord(toolData(part));

  if (name === 'getWalletInfo') {
    return `wallet connected=${String(data.connected)} address=${String(data.address ?? 'none')} network=${String(data.network ?? 'unknown')}`;
  }

  if (name === 'getSuiBalance') {
    return `balance ${String(data.formatted ?? data.totalBalance ?? 'unknown')} coin=${String(data.coinType ?? 'unknown')}`;
  }

  if (name === 'getCoinBalances') {
    const items = Array.isArray(toolData(part)) ? toolData(part) as unknown[] : [];
    return `coin balances count=${items.length}`;
  }

  if (name === 'getOwnedObjects') {
    const items = Array.isArray(toolData(part)) ? toolData(part) as unknown[] : [];
    return `owned objects count=${items.length}`;
  }

  if (name === 'getWalFormPortfolio') {
    const forms = Array.isArray(data.forms) ? data.forms.length : 0;
    const adminCaps = Array.isArray(data.adminCaps) ? data.adminCaps.length : 0;
    const tx = Array.isArray(data.recentTransactions) ? data.recentTransactions.length : 0;
    return `walform portfolio forms=${forms} adminCaps=${adminCaps} recentTx=${tx}`;
  }

  return null;
}

function buildConversationMemory(messages: UIMessage[]) {
  const lines = messages.slice(-8).flatMap((message) => {
    const text = getText(message).trim();
    const textLine = text ? `${message.role}: ${text.slice(0, 240)}` : null;
    const toolLines = message.parts
      .filter((part) => part.type.startsWith('tool-'))
      .map((part) => summarizeToolPart(part as ToolPart))
      .filter((line): line is string => Boolean(line));

    return [textLine, ...toolLines].filter((line): line is string => Boolean(line));
  });

  return lines.slice(-12).join('\n');
}

function shortId(value: string, head = 8, tail = 6) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function proposalTitle(proposal: TransactionProposal) {
  if (proposal.kind === 'transfer_sui') return 'SUI transfer';
  if (proposal.kind === 'transfer_sui_many') return 'Batch SUI transfer';
  if (proposal.kind === 'transfer_object') return 'NFT / object transfer';
  if (proposal.kind === 'batch_transfer') return 'Batch transfer';
  return 'Token swap';
}

export function FloatingChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(null);
  const [executedDigests, setExecutedDigests] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const network = SUI_NETWORK as HarnessNetwork;

  const { messages, sendMessage, status, stop, error, regenerate, addToolOutput } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest({ messages: nextMessages }) {
        return {
          body: {
            messages: nextMessages,
            memory: buildConversationMemory(nextMessages),
          },
        };
      },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      const call = toolCall as ChatToolCall;
      if (call.dynamic) return;

      try {
        const output = await runHarnessTool(call);
        addToolOutput({
          tool: call.toolName,
          toolCallId: call.toolCallId,
          output,
        });
      } catch (err) {
        addToolOutput({
          tool: call.toolName,
          toolCallId: call.toolCallId,
          state: 'output-error',
          errorText: err instanceof Error ? err.message : 'Tool execution failed.',
        });
      }
    },
  });

  const busy = status === 'submitted' || status === 'streaming';
  const hasMessages = messages.length > 0;
  const welcomeMessage = useMemo(
    () => ({
      id: 'welcome',
      role: 'assistant' as const,
      text: 'Ask me about WalForm, your connected Sui wallet, balances, owned forms, or prepare a transfer/swap proposal for review.',
    }),
    [],
  );

  async function runHarnessTool(call: ChatToolCall) {
    const toolInput = asRecord(call.input);

    if (call.toolName === 'getWalletInfo') {
      return getWalletInfo({ address: account?.address, network });
    }

    if (call.toolName === 'getSuiBalance') {
      return getSuiBalance({
        client: suiClient,
        address: account?.address,
        coinType: typeof toolInput.coinType === 'string' ? toolInput.coinType : undefined,
      });
    }

    if (call.toolName === 'getCoinBalances') {
      return getCoinBalances({
        client: suiClient,
        address: account?.address,
      });
    }

    if (call.toolName === 'getOwnedObjects') {
      return getOwnedObjectSummaries({
        client: suiClient,
        address: account?.address,
        limit: typeof toolInput.limit === 'number' ? toolInput.limit : 20,
      });
    }

    if (call.toolName === 'getWalFormPortfolio') {
      return getWalFormPortfolio(account?.address);
    }

    if (call.toolName === 'proposeTransferSui') {
      if (!account?.address) return { ok: false, error: 'Connect a wallet first.' };
      const balance = await suiClient.getBalance({ owner: account.address, coinType: '0x2::sui::SUI' });
      const proposal = createTransferSuiProposal({
        recipient: String(toolInput.recipient ?? ''),
        amountSui: String(toolInput.amountSui ?? ''),
        availableMist: balance.totalBalance,
      });
      return { ok: true, data: proposal };
    }

    if (call.toolName === 'proposeTransferSuiMany') {
      if (!account?.address) return { ok: false, error: 'Connect a wallet first.' };
      const recipientsInput = Array.isArray(toolInput.recipients) ? toolInput.recipients : [];
      const balance = await suiClient.getBalance({ owner: account.address, coinType: '0x2::sui::SUI' });
      const proposal = createTransferSuiManyProposal({
        recipients: recipientsInput.map((item) => {
          const record = asRecord(item);
          return {
            recipient: String(record.recipient ?? ''),
            amountSui: String(record.amountSui ?? ''),
          };
        }),
        availableMist: balance.totalBalance,
      });
      return { ok: true, data: proposal };
    }

    if (call.toolName === 'proposeTransferObject') {
      if (!account?.address) return { ok: false, error: 'Connect a wallet first.' };
      const proposal = createTransferObjectProposal({
        objectId: String(toolInput.objectId ?? ''),
        recipient: String(toolInput.recipient ?? ''),
      });
      return { ok: true, data: proposal };
    }

    if (call.toolName === 'proposeBatchTransfer') {
      if (!account?.address) return { ok: false, error: 'Connect a wallet first.' };
      const balance = await suiClient.getBalance({ owner: account.address, coinType: '0x2::sui::SUI' });
      const proposal = createBatchTransferProposal({
        recipient: String(toolInput.recipient ?? ''),
        amountSui: typeof toolInput.amountSui === 'string' ? toolInput.amountSui : undefined,
        objectIds: Array.isArray(toolInput.objectIds) ? toolInput.objectIds.map(String) : [],
        availableMist: balance.totalBalance,
      });
      return { ok: true, data: proposal };
    }

    if (call.toolName === 'proposeSwap') {
      if (!account?.address) return { ok: false, error: 'Connect a wallet first.' };
      const proposal = await aftermathSwapProvider.quote({
        walletAddress: account.address,
        network,
        coinInType: String(toolInput.coinInType ?? ''),
        coinOutType: String(toolInput.coinOutType ?? ''),
        amountIn: String(toolInput.amountIn ?? ''),
        slippage: typeof toolInput.slippage === 'number' ? toolInput.slippage : 0.01,
      });
      return { ok: true, data: proposal };
    }

    return { ok: false, error: `Unknown tool: ${call.toolName}` };
  }

  function submitMessage(value = input) {
    const text = value.trim();
    if (!text || busy) return;

    sendMessage({ text });
    setInput('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
  }

  async function executeProposal(proposal: TransactionProposal) {
    if (!account?.address) {
      toast.error('Connect your wallet first.');
      return;
    }

    setExecutingProposalId(proposal.id);
    try {
      const transaction = proposal.kind === 'transfer_sui'
        ? buildTransferSuiTx(proposal)
        : proposal.kind === 'transfer_sui_many'
          ? buildTransferSuiManyTx(proposal)
          : proposal.kind === 'transfer_object'
            ? buildTransferObjectTx(proposal)
            : proposal.kind === 'batch_transfer'
              ? buildBatchTransferTx(proposal)
              : await aftermathSwapProvider.buildTransaction(proposal, account.address);
      const result = await signAndExecuteTransaction({ transaction });
      const digest = result.digest;

      setExecutedDigests((current) => ({ ...current, [proposal.id]: digest }));
      toast.success('Transaction submitted.');
      sendMessage({
        text: `Transaction executed for proposal ${proposal.id}. Digest: ${digest}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setExecutingProposalId(null);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 max-sm:bottom-4 max-sm:right-4">
      {open && (
        <section className="chat-panel flex h-[min(720px,calc(100vh-6.5rem))] w-[440px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[28px] border border-[#91e0da66] bg-white shadow-[0_24px_70px_rgba(18,71,65,0.22)]">
          <header className="relative overflow-hidden border-b border-[#91e0da55] bg-[#124741] px-5 py-4 text-white">
            <div className="absolute -right-12 -top-16 h-36 w-36 rounded-full bg-[#91e0da] opacity-25 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl border border-white/20 bg-white/12">
                  <Bot className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#91e0da]">
                    WalForm AI
                  </p>
                  <h2 className="font-serif text-2xl font-bold italic leading-none tracking-[-0.04em]">
                    Wallet copilot
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-white/75 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                <X className="size-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f4fcf7] px-4 py-5">
            {!hasMessages && (
              <>
                <ChatBubble role="assistant">{welcomeMessage.text}</ChatBubble>
                <div className="grid gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submitMessage(suggestion)}
                      className="rounded-2xl border border-[#91e0da55] bg-white px-4 py-3 text-left text-sm font-semibold text-[#124741] shadow-sm transition hover:-translate-y-0.5 hover:border-[#91e0da] hover:shadow-md disabled:opacity-50"
                      disabled={busy}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((message) => (
              <MessageView
                key={message.id}
                message={message}
                executingProposalId={executingProposalId}
                executedDigests={executedDigests}
                onExecuteProposal={executeProposal}
              />
            ))}

            {status === 'submitted' && (
              <ChatBubble role="assistant">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking...
                </span>
              </ChatBubble>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <p className="font-bold">Chat is unavailable.</p>
                <p className="mt-1">
                  Check `OPENAI_API_KEY` in `.env.local`, then retry the last message.
                </p>
                <button
                  type="button"
                  onClick={() => regenerate()}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-800"
                >
                  <RefreshCcw className="size-3.5" />
                  Retry
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#91e0da55] bg-white p-3">
            <div className="flex items-end gap-2 rounded-[22px] border border-[#d9ece7] bg-[#f8fffc] p-2 focus-within:border-[#91e0da] focus-within:ring-4 focus-within:ring-[#91e0da33]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                rows={1}
                placeholder="Ask about wallet, forms, or swaps..."
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#124741] outline-none placeholder:text-[#6c8289]"
                disabled={busy || error != null}
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#124741] text-white transition hover:bg-[#0d302c]"
                  aria-label="Stop response"
                >
                  <Square className="size-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || error != null}
                  className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#124741] text-white transition hover:bg-[#0d302c] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'group grid size-16 place-items-center rounded-full border border-[#91e0da88] bg-[#124741] text-white shadow-[0_18px_45px_rgba(18,71,65,0.32)] transition hover:-translate-y-1 hover:bg-[#0d302c]',
          open && 'scale-95',
        )}
        aria-label={open ? 'Hide chat assistant' : 'Open chat assistant'}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-7" />}
      </button>
    </div>
  );
}

function MessageView({
  message,
  executingProposalId,
  executedDigests,
  onExecuteProposal,
}: {
  message: UIMessage;
  executingProposalId: string | null;
  executedDigests: Record<string, string>;
  onExecuteProposal: (proposal: TransactionProposal) => void;
}) {
  const text = getText(message);
  const hideTextForDataTool = message.role === 'assistant' && hasRenderableDataTool(message);

  return (
    <div className="space-y-3">
      {text && !hideTextForDataTool && <ChatBubble role={message.role}>{text}</ChatBubble>}
      {message.parts.map((part, index) => {
        if (!part.type.startsWith('tool-')) return null;
        return (
          <ToolPartView
            key={`${message.id}-${index}`}
            part={part as ToolPart}
            executingProposalId={executingProposalId}
            executedDigests={executedDigests}
            onExecuteProposal={onExecuteProposal}
          />
        );
      })}
    </div>
  );
}

function ToolPartView({
  part,
  executingProposalId,
  executedDigests,
  onExecuteProposal,
}: {
  part: ToolPart;
  executingProposalId: string | null;
  executedDigests: Record<string, string>;
  onExecuteProposal: (proposal: TransactionProposal) => void;
}) {
  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <div className="rounded-2xl border border-[#d9ece7] bg-white px-4 py-3 text-sm text-[#6c8289]">
        Running {part.type.replace('tool-', '')}...
      </div>
    );
  }

  if (part.state === 'output-error') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {part.errorText ?? 'Tool failed.'}
      </div>
    );
  }

  if (part.state !== 'output-available') return null;

  const output = asRecord(part.output);
  if (output.ok === false) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {String(output.error ?? 'Tool returned an error.')}
      </div>
    );
  }

  const proposal = unwrapProposal(part.output);
  if (proposal) {
    return (
      <ProposalCard
        proposal={proposal}
        executing={executingProposalId === proposal.id}
        digest={executedDigests[proposal.id]}
        onExecute={() => onExecuteProposal(proposal)}
      />
    );
  }

  const toolName = toolNameFromPart(part);
  const data = toolData(part);

  if (toolName === 'getWalletInfo') {
    return (
      <ChatDataCard
        icon={<Wallet className="size-5" />}
        label="Wallet"
        title={asRecord(data).connected === true ? 'Connected' : 'Not connected'}
        badge={String(asRecord(data).network ?? 'unknown')}
        rows={[{ label: 'Address', value: String(asRecord(data).address ?? 'No wallet connected') }]}
      />
    );
  }

  if (toolName === 'getSuiBalance') {
    const record = asRecord(data);
    return (
      <ChatDataCard
        icon={<CircleDollarSign className="size-5" />}
        label="Token balance"
        title={String(record.formatted ?? 'Unknown balance')}
        rows={[{ label: 'Token', value: String(record.symbol ?? 'TOKEN') }]}
      />
    );
  }

  if (toolName === 'getCoinBalances') {
    return <TokenBalancesCard data={Array.isArray(data) ? data : []} />;
  }

  if (toolName === 'getOwnedObjects') {
    return <OwnedObjectsCard data={Array.isArray(data) ? data : []} />;
  }

  if (toolName === 'getWalFormPortfolio') {
    return <PortfolioCard data={asRecord(data)} />;
  }

  return (
    <div className="rounded-2xl border border-[#d9ece7] bg-white px-4 py-3 text-sm text-[#1c3935] shadow-sm">
      <div className="flex items-center gap-2 font-bold text-[#124741]">
        <ShieldCheck className="size-4" />
        {toolName}
      </div>
    </div>
  );
}

function ChatDataCard({
  icon,
  label,
  title,
  badge,
  rows,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  badge?: string;
  rows?: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-2xl border border-[#d9ece7] bg-white p-4 text-sm text-[#1c3935] shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#e7f8f5] text-[#124741]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6c8289]">
            {label}
          </p>
          <p className="mt-1 break-words text-xl font-black leading-tight text-[#124741]">
            {title}
          </p>
        </div>
        {badge && (
          <span className="rounded-full bg-[#f4fcf7] px-2.5 py-1 text-xs font-bold uppercase text-[#6c8289]">
            {badge}
          </span>
        )}
      </div>
      {rows && rows.length > 0 && (
        <dl className="mt-3 grid gap-2">
          {rows.map((row) => (
            <Detail key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>
      )}
    </div>
  );
}

function OwnedObjectsCard({ data }: { data: unknown[] }) {
  const items = data.slice(0, 10).map((item) => {
    const record = asRecord(item);
    const type = String(record.type ?? 'Unknown object');
    const objectId = String(record.objectId ?? '');
    const displayName = typeof record.displayName === 'string' ? record.displayName : null;
    const fallbackName = type.split('::').at(-1) ?? 'Object';

    return {
      name: displayName ?? fallbackName,
      objectId,
      type,
    };
  });

  return (
    <div className="rounded-2xl border border-[#d9ece7] bg-white p-4 text-sm text-[#1c3935] shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#e7f8f5] text-[#124741]">
          <Database className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6c8289]">
            Owned objects
          </p>
          <p className="mt-1 text-xl font-black leading-tight text-[#124741]">
            {data.length} found
          </p>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div key={item.objectId} className="rounded-xl bg-[#f4fcf7] px-3 py-2">
              <p className="font-bold text-[#124741]">{item.name}</p>
              <p className="mt-1 break-all font-mono text-xs text-[#6c8289]">{item.objectId}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TokenBalancesCard({ data }: { data: unknown[] }) {
  const items = data.map((item) => {
    const record = asRecord(item);
    return {
      symbol: String(record.symbol ?? 'TOKEN'),
      formatted: String(record.formatted ?? record.totalBalance ?? '0'),
    };
  });

  return (
    <div className="rounded-2xl border border-[#d9ece7] bg-white p-4 text-sm text-[#1c3935] shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#e7f8f5] text-[#124741]">
          <CircleDollarSign className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6c8289]">
            Token balances
          </p>
          <p className="mt-1 text-xl font-black leading-tight text-[#124741]">
            {items.length} token{items.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item.symbol} className="rounded-xl bg-[#f4fcf7] px-3 py-2">
            <p className="font-black text-[#124741]">{item.formatted}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#6c8289]">
              {item.symbol}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioCard({ data }: { data: Record<string, unknown> }) {
  const forms = Array.isArray(data.forms) ? data.forms : [];
  const adminCaps = Array.isArray(data.adminCaps) ? data.adminCaps : [];
  const recentTransactions = Array.isArray(data.recentTransactions) ? data.recentTransactions : [];

  return (
    <div className="rounded-2xl border border-[#d9ece7] bg-white p-4 text-sm text-[#1c3935] shadow-sm">
      <div className="flex items-center gap-2 font-bold text-[#124741]">
        <ShieldCheck className="size-4" />
        WalForm portfolio
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Forms" value={forms.length} />
        <Metric label="Admin caps" value={adminCaps.length} />
        <Metric label="Recent tx" value={recentTransactions.length} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f4fcf7] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6c8289]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#124741]">{value}</p>
    </div>
  );
}

function ProposalCard({
  proposal,
  executing,
  digest,
  onExecute,
}: {
  proposal: TransactionProposal;
  executing: boolean;
  digest?: string;
  onExecute: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#9adbd5] bg-white text-sm text-[#1c3935] shadow-[0_16px_40px_rgba(18,71,65,0.12)]">
      <div className="bg-[linear-gradient(135deg,#123f3a,#17655d)] px-4 py-3 text-white">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/15">
            {proposal.kind === 'transfer_object' ? <FileKey2 className="size-5" /> : <ShieldCheck className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#91e0da] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#123f3a]">
                Review required
              </span>
              {digest && (
                <span className="rounded-full bg-emerald-300/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                  Submitted
                </span>
              )}
            </div>
            <h3 className="mt-2 font-serif text-2xl font-bold italic leading-none tracking-[-0.04em]">
              {proposalTitle(proposal)}
            </h3>
            <p className="mt-2 break-words text-sm leading-5 text-white/78">
              {proposal.summary.replace(/(0x[0-9a-fA-F]{20,})/g, (addr) => shortId(addr, 8, 6))}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <ProposalDetails proposal={proposal} />

        <div className="rounded-2xl border border-[#d9ece7] bg-[#f8fffc] px-3 py-2 text-xs text-[#55706b]">
          Wallet signature is required. WalForm only builds the transaction proposal; your wallet executes it.
        </div>

        {digest ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            <span className="inline-flex min-w-0 items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span className="truncate">Digest {shortId(digest, 10, 8)}</span>
            </span>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 uppercase tracking-[0.12em]">Done</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onExecute}
            disabled={executing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#124741] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0d302c] disabled:cursor-wait disabled:opacity-60"
          >
            {executing && <Loader2 className="size-3.5 animate-spin" />}
            Review & sign in wallet
          </button>
        )}
      </div>
    </div>
  );
}

function ProposalDetails({ proposal }: { proposal: TransactionProposal }) {
  if (proposal.kind === 'transfer_sui') {
    const transfer = proposal as TransferSuiProposal;
    return (
      <dl className="mt-3 grid gap-2 rounded-2xl bg-[#f4fcf7] p-3 text-xs">
        <Detail label="Amount" value={`${transfer.amountSui} SUI`} />
        <Detail label="Recipient" value={transfer.recipient} />
      </dl>
    );
  }

  if (proposal.kind === 'transfer_sui_many') {
    const transfer = proposal as TransferSuiManyProposal;
    return (
      <div className="rounded-2xl bg-[#f4fcf7] p-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <Detail label="Total" value={`${transfer.totalAmountSui} SUI`} />
          <Detail label="Recipients" value={`${transfer.recipients.length}`} />
        </div>
        <div className="mt-3 grid gap-2">
          {transfer.recipients.map((item) => (
            <div key={`${item.recipient}-${item.amountMist}`} className="rounded-xl bg-white px-3 py-2">
              <p className="font-black text-[#124741]">{item.amountSui} SUI</p>
              <p className="mt-1 break-all font-mono text-[11px] text-[#6c8289]">{item.recipient}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (proposal.kind === 'transfer_object') {
    const transfer = proposal as TransferObjectProposal;
    return (
      <dl className="mt-3 grid gap-2 rounded-2xl bg-[#f4fcf7] p-3 text-xs">
        <Detail label="Object / NFT" value={transfer.objectId} />
        <Detail label="Recipient" value={transfer.recipient} />
      </dl>
    );
  }

  if (proposal.kind === 'batch_transfer') {
    const batch = proposal as BatchTransferProposal;
    const suiItem = batch.items.find((item): item is Extract<typeof item, { type: 'sui' }> => item.type === 'sui');
    const objectItems = batch.items.filter((item): item is Extract<typeof item, { type: 'object' }> => item.type === 'object');
    return (
      <div className="mt-3 rounded-2xl bg-[#f4fcf7] p-3 text-xs">
        <Detail label="Recipient" value={batch.recipient} />
        {suiItem && (
          <div className="mt-2">
            <Detail label="SUI amount" value={`${suiItem.amountSui} SUI`} />
          </div>
        )}
        {objectItems.length > 0 && (
          <div className="mt-2 grid gap-1">
            <dt className="font-black uppercase tracking-[0.14em] text-[#6c8289]">
              Objects ({objectItems.length})
            </dt>
            {objectItems.map((item) => (
              <dd
                key={item.objectId}
                className="cursor-default font-mono font-semibold text-[#124741]"
                title={item.objectId}
              >
                {shortId(item.objectId, 10, 8)}
              </dd>
            ))}
          </div>
        )}
        <p className="mt-3 rounded-xl bg-[#124741]/8 px-2 py-1.5 font-semibold text-[#124741]">
          All items above will be transferred in a single transaction.
        </p>
      </div>
    );
  }

  const swap = proposal as SwapProposal;
  return (
    <dl className="mt-3 grid gap-2 rounded-2xl bg-[#f4fcf7] p-3 text-xs">
      <Detail label="Provider" value="Aftermath Router" />
      <Detail label="Input" value={`${swap.amountIn} ${swap.coinInType}`} />
      <Detail label="Expected output" value={`${swap.expectedAmountOut} ${swap.coinOutType}`} />
      <Detail label="Min output" value={swap.minAmountOut} />
      <Detail label="Slippage" value={`${(swap.slippage * 100).toFixed(2)}%`} />
    </dl>
  );
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40,}$/;

function Detail({ label, value }: { label: string; value: string }) {
  const isAddr = ADDRESS_RE.test(value);
  return (
    <div className="grid gap-1">
      <dt className="font-black uppercase tracking-[0.14em] text-[#6c8289]">{label}</dt>
      {isAddr ? (
        <dd
          className="cursor-default font-mono font-semibold text-[#124741]"
          title={value}
        >
          {shortId(value, 10, 8)}
        </dd>
      ) : (
        <dd className="break-all font-semibold text-[#124741]">{value}</dd>
      )}
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let key = 0;

  const renderInline = (line: string): React.ReactNode => {
    // Split on **bold**, `code`, and digest-like hex strings
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="rounded bg-black/8 px-1 py-0.5 font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      nodes.push(<div key={key++} className="h-2" />);
      continue;
    }
    // Bullet list
    if (/^[-•*]\s/.test(line)) {
      nodes.push(
        <div key={key++} className="flex gap-2">
          <span className="mt-0.5 shrink-0 text-[#91e0da]">•</span>
          <span>{renderInline(line.replace(/^[-•*]\s/, ''))}</span>
        </div>,
      );
      continue;
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1];
      nodes.push(
        <div key={key++} className="flex gap-2">
          <span className="mt-0.5 shrink-0 font-bold text-[#91e0da]">{num}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>,
      );
      continue;
    }
    nodes.push(<p key={key++}>{renderInline(line)}</p>);
  }

  return nodes;
}

function ChatBubble({
  role,
  children,
}: {
  role: UIMessage['role'] | 'assistant';
  children: React.ReactNode;
}) {
  const user = role === 'user';
  const isText = typeof children === 'string';

  return (
    <div className={cn('flex', user ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm',
          user
            ? 'rounded-br-md bg-[#124741] text-white'
            : 'rounded-bl-md border border-[#d9ece7] bg-white text-[#1c3935]',
          !user && 'space-y-1',
        )}
      >
        {isText && !user ? renderMarkdown(children) : children}
      </div>
    </div>
  );
}
