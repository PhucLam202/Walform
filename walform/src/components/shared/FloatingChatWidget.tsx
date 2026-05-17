'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { usePathname } from 'next/navigation';
import {
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Copy,
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
  getWalFormFormStats,
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
    const summary = asRecord(data.summary);
    const latestOwnedForm = asRecord(summary.latestOwnedForm);
    const latestReceivedSubmission = asRecord(summary.latestReceivedSubmission);
    const latestFormTitle = typeof latestOwnedForm.title === 'string' ? latestOwnedForm.title : 'none';
    const latestSubmissionFormTitle = typeof latestReceivedSubmission.formTitle === 'string'
      ? latestReceivedSubmission.formTitle
      : 'none';
    return [
      `walform portfolio forms=${forms} adminCaps=${adminCaps} recentTx=${tx}`,
      `latestOwnedForm=${latestFormTitle} id=${String(latestOwnedForm.id ?? 'none')} createdAt=${String(latestOwnedForm.created_at ?? 'none')}`,
      `latestReceivedSubmissionForm=${latestSubmissionFormTitle} blobId=${String(latestReceivedSubmission.blobId ?? 'none')} submittedAt=${String(latestReceivedSubmission.submittedAt ?? 'none')}`,
      `respondentSubmissionTrackingAvailable=${String(summary.respondentSubmissionTrackingAvailable ?? false)}`,
    ].join(' ');
  }

  if (name === 'getWalFormFormStats') {
    const match = String(data.match ?? 'unknown');
    const form = asRecord(data.form);
    const stats = asRecord(data.stats);
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    if (match === 'single') {
      return [
        `walform form stats match=single title=${String(form.title ?? 'unknown')} id=${String(form.id ?? 'unknown')}`,
        `createdAt=${String(form.createdAtIso ?? form.created_at ?? 'unknown')}`,
        `submissionCount=${String(stats.bestKnownSubmissionCount ?? form.submission_count ?? 'unknown')}`,
        `active=${String(form.is_active ?? 'unknown')}`,
      ].join(' ');
    }
    return `walform form stats match=${match} candidates=${candidates.length}`;
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

function shortenMiddle(value: string, start = 8, end = 6): string {
  return shortId(value, start, end);
}

function TruncatedValue({
  value,
  start = 8,
  end = 6,
  mono = false,
  copyable = false,
}: {
  value: string;
  start?: number;
  end?: number;
  mono?: boolean;
  copyable?: boolean;
}) {
  const needsTrunc = value.length > start + end + 1;
  const display = needsTrunc ? shortenMiddle(value, start, end) : value;
  return (
    <span
      className={cn('min-w-0 break-words text-sm font-semibold text-[#124741]', mono && 'font-mono')}
      style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}
      title={needsTrunc ? value : undefined}
    >
      {display}
      {copyable && (
        <button
          type="button"
          onClick={() => { void navigator.clipboard.writeText(value); toast.success('Copied!'); }}
          className="ml-1 inline-flex size-4 items-center justify-center rounded text-[#6c8289] hover:text-[#124741]"
          aria-label="Copy"
        >
          <Copy className="size-3" />
        </button>
      )}
    </span>
  );
}

function proposalTitle(proposal: TransactionProposal) {
  if (proposal.kind === 'transfer_sui') return 'SUI transfer';
  if (proposal.kind === 'transfer_sui_many') return 'Batch SUI transfer';
  if (proposal.kind === 'transfer_object') return 'NFT / object transfer';
  if (proposal.kind === 'batch_transfer') return 'Batch transfer';
  return 'Token swap';
}

function getActiveFormId(pathname: string | null) {
  const match = pathname?.match(/^\/forms\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function WidgetHeader({
  accountAddress,
  onClose,
}: {
  accountAddress: string | null;
  onClose: () => void;
}) {
  return (
    <header className="border-b border-[#d9ece7] bg-[linear-gradient(180deg,#ffffff,#f7fffb)] px-5 py-4 text-[#124741]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#124741] text-white shadow-sm">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6c8289]">
              WALFORM AI
            </p>
            <h2 className="font-serif text-2xl font-bold italic leading-none tracking-[-0.04em]">
              Wallet Copilot
            </h2>
            <p className="mt-1 min-w-0 text-xs text-[#6c8289]">
              {accountAddress ? (
                <>Connected · <TruncatedValue value={accountAddress} start={8} end={6} mono /></>
              ) : (
                'Not connected'
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-[#d9ece7] p-2 text-[#6c8289] transition hover:border-[#91e0da] hover:bg-[#f4fcf7] hover:text-[#124741]"
          aria-label="Close chat"
        >
          <X className="size-5" />
        </button>
      </div>
    </header>
  );
}

function ContextBar({
  pathname,
  activeFormId,
  accountAddress,
  network,
}: {
  pathname: string;
  activeFormId: string | null;
  accountAddress: string | null;
  network: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#d9ece7] bg-[#f7fffb] px-5 py-2">
      <span
        className="max-w-[160px] overflow-hidden rounded-full bg-[#eef8f4] px-3 py-1 text-xs font-semibold text-[#124741]"
        style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={pathname || '/'}
      >
        {pathname || '/'}
      </span>
      {activeFormId && (
        <span className="min-w-0 rounded-full bg-[#e7f8f5] px-3 py-1 font-mono text-xs font-semibold text-[#124741]">
          <TruncatedValue value={activeFormId} start={10} end={8} />
        </span>
      )}
      <span
        className={cn(
          'rounded-full px-3 py-1 text-xs font-bold',
          accountAddress ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
        )}
      >
        {accountAddress ? `${network} · Ready` : 'Not connected'}
      </span>
    </div>
  );
}

export function FloatingChatWidget() {
  const account = useCurrentAccount();
  const pathname = usePathname();
  const activeFormId = getActiveFormId(pathname);
  const accountAddress = account?.address ?? null;

  return (
    <FloatingChatWidgetInner
      key={`${accountAddress ?? 'no-wallet'}:${activeFormId ?? 'no-form'}`}
      accountAddress={accountAddress}
      pathname={pathname ?? '/'}
      activeFormId={activeFormId}
    />
  );
}

function FloatingChatWidgetInner({
  accountAddress,
  pathname,
  activeFormId,
}: {
  accountAddress: string | null;
  pathname: string;
  activeFormId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(null);
  const [executedDigests, setExecutedDigests] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
            appContext: {
              wallet: {
                connected: Boolean(accountAddress),
                address: accountAddress,
                network,
              },
              route: pathname,
              activeFormId,
            },
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

  async function runHarnessTool(call: ChatToolCall) {
    const toolInput = asRecord(call.input);

    if (call.toolName === 'getWalletInfo') {
      return getWalletInfo({ address: accountAddress, network });
    }

    if (call.toolName === 'getSuiBalance') {
      return getSuiBalance({
        client: suiClient,
        address: accountAddress,
        coinType: typeof toolInput.coinType === 'string' ? toolInput.coinType : undefined,
      });
    }

    if (call.toolName === 'getCoinBalances') {
      return getCoinBalances({
        client: suiClient,
        address: accountAddress,
      });
    }

    if (call.toolName === 'getOwnedObjects') {
      return getOwnedObjectSummaries({
        client: suiClient,
        address: accountAddress,
        limit: typeof toolInput.limit === 'number' ? toolInput.limit : 20,
      });
    }

    if (call.toolName === 'getWalFormPortfolio') {
      return getWalFormPortfolio(accountAddress);
    }

    if (call.toolName === 'getWalFormFormStats') {
      return getWalFormFormStats({
        address: accountAddress,
        formReference: typeof toolInput.formReference === 'string' ? toolInput.formReference : undefined,
        activeFormId,
      });
    }

    if (call.toolName === 'proposeTransferSui') {
      if (!accountAddress) return { ok: false, error: 'Connect a wallet first.' };
      const balance = await suiClient.getBalance({ owner: accountAddress, coinType: '0x2::sui::SUI' });
      const proposal = createTransferSuiProposal({
        recipient: String(toolInput.recipient ?? ''),
        amountSui: String(toolInput.amountSui ?? ''),
        availableMist: balance.totalBalance,
      });
      return { ok: true, data: proposal };
    }

    if (call.toolName === 'proposeTransferSuiMany') {
      if (!accountAddress) return { ok: false, error: 'Connect a wallet first.' };
      const recipientsInput = Array.isArray(toolInput.recipients) ? toolInput.recipients : [];
      const balance = await suiClient.getBalance({ owner: accountAddress, coinType: '0x2::sui::SUI' });
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
      if (!accountAddress) return { ok: false, error: 'Connect a wallet first.' };
      const proposal = createTransferObjectProposal({
        objectId: String(toolInput.objectId ?? ''),
        recipient: String(toolInput.recipient ?? ''),
      });
      return { ok: true, data: proposal };
    }

    if (call.toolName === 'proposeBatchTransfer') {
      if (!accountAddress) return { ok: false, error: 'Connect a wallet first.' };
      const balance = await suiClient.getBalance({ owner: accountAddress, coinType: '0x2::sui::SUI' });
      const proposal = createBatchTransferProposal({
        recipient: String(toolInput.recipient ?? ''),
        amountSui: typeof toolInput.amountSui === 'string' ? toolInput.amountSui : undefined,
        objectIds: Array.isArray(toolInput.objectIds) ? toolInput.objectIds.map(String) : [],
        availableMist: balance.totalBalance,
      });
      return { ok: true, data: proposal };
    }

    if (call.toolName === 'proposeSwap') {
      if (!accountAddress) return { ok: false, error: 'Connect a wallet first.' };
      const proposal = await aftermathSwapProvider.quote({
        walletAddress: accountAddress,
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
    if (!accountAddress) {
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
              : await aftermathSwapProvider.buildTransaction(proposal, accountAddress);
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
    <div className="fixed inset-0 z-50 pointer-events-none">
      {open && (
        <>
          <button
            type="button"
            aria-label="Close chat overlay"
            className="pointer-events-auto fixed inset-0 cursor-default bg-slate-950/10 backdrop-blur-[1px] max-sm:bg-slate-950/15"
            onClick={() => setOpen(false)}
          />
          <section className="chat-panel pointer-events-auto fixed bottom-5 right-5 flex h-[min(84vh,820px)] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[26px] border border-[#91e0da66] bg-[rgba(255,255,255,0.96)] shadow-[0_28px_90px_rgba(18,71,65,0.28)] backdrop-blur-xl max-sm:bottom-3 max-sm:left-3 max-sm:right-3 max-sm:h-[min(88vh,820px)] max-sm:w-auto">
            <WidgetHeader accountAddress={accountAddress} onClose={() => setOpen(false)} />
            <ContextBar
              pathname={pathname}
              activeFormId={activeFormId}
              accountAddress={accountAddress}
              network={network}
            />

            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#fbfffd,#f4fcf7)] px-4 py-4">
              <div className="space-y-4">
                {!hasMessages && (
                  <>
                    <div className="rounded-[22px] border border-[#d9ece7] bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6c8289]">
                        Quick start
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#1c3935]">
                        Ask about wallet balance, your forms, latest submissions, or a specific form name. If a form name appears more than once, I will ask you to choose.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => submitMessage(suggestion)}
                          className="rounded-2xl border border-[#d9ece7] bg-white px-4 py-3 text-left text-sm font-semibold text-[#124741] shadow-sm transition hover:-translate-y-0.5 hover:border-[#91e0da] hover:shadow-md disabled:opacity-50"
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
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[#d9ece7] bg-white p-3">
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
                  className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-[#124741] outline-none placeholder:text-[#6c8289]"
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
        </>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'pointer-events-auto fixed bottom-5 right-5 grid size-16 place-items-center rounded-full border border-[#91e0da88] bg-[#124741] text-white shadow-[0_18px_45px_rgba(18,71,65,0.32)] transition hover:-translate-y-1 hover:bg-[#0d302c] max-sm:bottom-4 max-sm:right-4',
          )}
          aria-label="Open chat assistant"
        >
          <MessageCircle className="size-7" />
        </button>
      )}
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

  return (
    <div className="space-y-3">
      {text && <ChatBubble role={message.role}>{text}</ChatBubble>}
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

  if (toolName === 'getWalFormFormStats') {
    return <FormStatsCard data={asRecord(data)} />;
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

function CopilotCard({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'warning' | 'proposal';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 max-w-full overflow-hidden rounded-2xl border text-sm shadow-sm',
        variant === 'default' && 'border-[#d9ece7] bg-white text-[#1c3935]',
        variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-950',
        variant === 'proposal' && 'rounded-[24px] border-[#9adbd5] bg-white text-[#1c3935] shadow-[0_16px_40px_rgba(18,71,65,0.12)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

type ActionIntent = 'primary' | 'secondary' | 'ghost' | 'success' | 'warning' | 'danger';
type ActionType =
  | 'get_wallet'
  | 'get_balance'
  | 'get_transactions'
  | 'get_transaction_detail'
  | 'get_assets'
  | 'get_form'
  | 'copy'
  | 'refresh'
  | 'send_token'
  | 'transfer_token'
  | 'swap_token'
  | 'sign_transaction'
  | 'confirm_transaction'
  | 'cancel_transaction'
  | 'open_explorer'
  | 'retry';

function CopilotActionButton({
  label,
  actionType,
  intent = 'primary',
  icon,
  loading,
  disabled,
  onClick,
  className,
}: {
  label: string;
  actionType: ActionType;
  intent?: ActionIntent;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      data-action-type={actionType}
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#91e0da] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        intent === 'primary' && 'bg-[#124741] text-white hover:bg-[#0d302c]',
        intent === 'secondary' && 'border border-[#d9ece7] bg-white text-[#124741] hover:border-[#91e0da] hover:bg-[#f4fcf7]',
        intent === 'ghost' && 'bg-transparent text-[#6c8289] hover:text-[#124741]',
        intent === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700',
        intent === 'warning' && 'bg-amber-500 text-white hover:bg-amber-600',
        intent === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        className,
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  );
}

function CopilotActionGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
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
    <CopilotCard>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#e7f8f5] text-[#124741]">
            {icon}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6c8289]">
              {label}
            </p>
            <p
              className="mt-1 min-w-0 break-words text-xl font-black leading-tight text-[#124741]"
              style={{ overflowWrap: 'anywhere' }}
            >
              {title}
            </p>
          </div>
          {badge && (
            <span className="shrink-0 rounded-full bg-[#f4fcf7] px-2.5 py-1 text-xs font-bold uppercase text-[#6c8289]">
              {badge}
            </span>
          )}
        </div>
        {rows && rows.length > 0 && (
          <dl className="mt-3 grid gap-2">
            {rows.map((row) => (
              <DataField key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        )}
      </div>
    </CopilotCard>
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
    <CopilotCard>
      <div className="p-4">
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
              <div key={item.objectId} className="min-w-0 overflow-hidden rounded-xl bg-[#f4fcf7] px-3 py-2">
                <p className="font-bold text-[#124741]">{item.name}</p>
                <div className="mt-1">
                  <TruncatedValue value={item.objectId} mono copyable />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CopilotCard>
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
    <CopilotCard>
      <div className="p-4">
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
            <div key={item.symbol} className="min-w-0 rounded-xl bg-[#f4fcf7] px-3 py-2">
              <p className="font-black text-[#124741]">{item.formatted}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#6c8289]">
                {item.symbol}
              </p>
            </div>
          ))}
        </div>
      </div>
    </CopilotCard>
  );
}

function PortfolioCard({ data }: { data: Record<string, unknown> }) {
  const forms = Array.isArray(data.forms) ? data.forms : [];
  const adminCaps = Array.isArray(data.adminCaps) ? data.adminCaps : [];
  const recentTransactions = Array.isArray(data.recentTransactions) ? data.recentTransactions : [];
  const summary = asRecord(data.summary);
  const latestOwnedForm = asRecord(summary.latestOwnedForm);
  const latestReceivedSubmission = asRecord(summary.latestReceivedSubmission);
  const latestFormTitle = typeof latestOwnedForm.title === 'string' ? latestOwnedForm.title : null;
  const latestSubmissionFormTitle = typeof latestReceivedSubmission.formTitle === 'string'
    ? latestReceivedSubmission.formTitle
    : null;
  const latestSubmissionTime = typeof latestReceivedSubmission.submittedAt === 'number'
    ? new Date(latestReceivedSubmission.submittedAt).toLocaleString()
    : null;

  return (
    <CopilotCard>
      <div className="p-4">
        <div className="flex items-center gap-2 font-bold text-[#124741]">
          <ShieldCheck className="size-4" />
          WalForm portfolio
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Forms" value={forms.length} />
          <Metric label="Admin caps" value={adminCaps.length} />
          <Metric label="Recent tx" value={recentTransactions.length} />
        </div>
        {(latestFormTitle || latestSubmissionFormTitle) && (
          <div className="mt-3 grid gap-2">
            {latestFormTitle && (
              <DataField label="Latest owned form" value={latestFormTitle} />
            )}
            {latestSubmissionFormTitle && (
              <DataField
                label="Latest received submission"
                value={latestSubmissionTime
                  ? `${latestSubmissionFormTitle} · ${latestSubmissionTime}`
                  : latestSubmissionFormTitle}
              />
            )}
          </div>
        )}
      </div>
    </CopilotCard>
  );
}

function FormStatsCard({ data }: { data: Record<string, unknown> }) {
  const match = String(data.match ?? 'unknown');
  const form = asRecord(data.form);
  const stats = asRecord(data.stats);
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];

  if (match === 'single') {
    const title = String(form.title ?? 'Unknown form');
    const createdAt = typeof form.createdAtIso === 'string'
      ? new Date(form.createdAtIso).toLocaleString()
      : 'Unknown';
    const count = Number(stats.bestKnownSubmissionCount ?? form.submission_count ?? 0);

    return (
      <CopilotCard>
        <div className="p-4">
          <div className="flex items-center gap-2 font-bold text-[#124741]">
            <FileKey2 className="size-4" />
            {title}
          </div>
          <div className="mt-3 grid gap-2">
            <DataField label="Submissions" value={String(count)} />
            <DataField label="Created" value={createdAt} />
            <DataField label="Status" value={form.is_active === true ? 'Active' : 'Closed'} />
          </div>
        </div>
      </CopilotCard>
    );
  }

  return (
    <CopilotCard variant="warning">
      <div className="p-4">
        <p className="font-bold">
          {match === 'multiple' ? 'Multiple forms matched' : 'No matching form found'}
        </p>
        {candidates.length > 0 && (
          <div className="mt-3 grid gap-2">
            {candidates.slice(0, 5).map((item, index) => {
              const candidate = asRecord(item);
              const title = String(candidate.title ?? `Form ${index + 1}`);
              const id = String(candidate.id ?? '');
              const createdAt = typeof candidate.createdAtIso === 'string'
                ? new Date(candidate.createdAtIso).toLocaleString()
                : 'Unknown';

              return (
                <div key={`${id}-${index}`} className="min-w-0 overflow-hidden rounded-xl bg-white/70 px-3 py-2">
                  <p className="font-bold">{title}</p>
                  <p className="mt-1 min-w-0 text-xs text-amber-800">
                    {createdAt} · <TruncatedValue value={id} start={8} end={6} />
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CopilotCard>
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

        <CopilotActionGroup>
          {digest ? (
            <div className="flex w-full items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
              <span className="inline-flex min-w-0 items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <TruncatedValue value={`Digest ${shortId(digest, 10, 8)}`} />
              </span>
              <span className="shrink-0 rounded-full bg-white px-2 py-1 uppercase tracking-[0.12em]">Done</span>
            </div>
          ) : (
            <CopilotActionButton
              label="Review & sign in wallet"
              actionType="sign_transaction"
              intent="primary"
              loading={executing}
              onClick={onExecute}
              className="w-full justify-center"
            />
          )}
        </CopilotActionGroup>
      </div>
    </div>
  );
}

function ProposalDetails({ proposal }: { proposal: TransactionProposal }) {
  if (proposal.kind === 'transfer_sui') {
    const transfer = proposal as TransferSuiProposal;
    return (
      <dl className="mt-3 grid gap-2 rounded-2xl bg-[#f4fcf7] p-3 text-xs">
        <DataField label="Amount" value={`${transfer.amountSui} SUI`} />
        <DataField label="Recipient" value={transfer.recipient} />
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
        <DataField label="Object / NFT" value={transfer.objectId} />
        <DataField label="Recipient" value={transfer.recipient} />
      </dl>
    );
  }

  if (proposal.kind === 'batch_transfer') {
    const batch = proposal as BatchTransferProposal;
    const suiItem = batch.items.find((item): item is Extract<typeof item, { type: 'sui' }> => item.type === 'sui');
    const objectItems = batch.items.filter((item): item is Extract<typeof item, { type: 'object' }> => item.type === 'object');
    return (
      <div className="mt-3 rounded-2xl bg-[#f4fcf7] p-3 text-xs">
        <DataField label="Recipient" value={batch.recipient} />
        {suiItem && (
          <div className="mt-2">
            <DataField label="SUI amount" value={`${suiItem.amountSui} SUI`} />
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
      <DataField label="Provider" value="Aftermath Router" />
      <DataField label="Input" value={`${swap.amountIn} ${swap.coinInType}`} />
      <DataField label="Expected output" value={`${swap.expectedAmountOut} ${swap.coinOutType}`} />
      <DataField label="Min output" value={swap.minAmountOut} />
      <DataField label="Slippage" value={`${(swap.slippage * 100).toFixed(2)}%`} />
    </dl>
  );
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40,}$/;

function DataField({
  label,
  value,
  copyable,
  mono,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}) {
  const isAddr = ADDRESS_RE.test(value);
  const isLong = value.length > 20;
  const shouldTrunc = isAddr || isLong;
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[#d9ece7] bg-[#f8fffc] px-3 py-2">
      <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6c8289]">{label}</dt>
      <dd className="mt-1 min-w-0">
        {shouldTrunc ? (
          <TruncatedValue
            value={value}
            start={isAddr ? 10 : 8}
            end={isAddr ? 8 : 6}
            mono={isAddr || !!mono}
            copyable={copyable ?? isAddr}
          />
        ) : (
          <span
            className={cn('text-sm font-semibold text-[#124741]', mono && 'font-mono')}
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}
          >
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}

const Detail = DataField;

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
          'max-w-[82%] rounded-[22px] px-4 py-3 text-sm leading-7 shadow-sm max-sm:max-w-[90%]',
          user
            ? 'rounded-br-md bg-[#124741] text-white'
            : 'rounded-bl-md border border-[#d9ece7] bg-white text-[#1c3935]',
          !user && 'space-y-2',
        )}
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {!user && (
          <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#6c8289]">
            <span>WalForm AI</span>
            <span>Response</span>
          </div>
        )}
        {isText && !user ? renderMarkdown(children) : children}
      </div>
    </div>
  );
}
