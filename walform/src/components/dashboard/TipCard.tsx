'use client';

import { Lightbulb } from 'lucide-react';

const TIPS = [
  'Mark sensitive fields so they get Seal-encrypted before upload.',
  'Share your form link — responders don\'t need a wallet to submit.',
  'Use the AdminCap to grant team members decryption access.',
  'Responses are stored on Walrus — they\'re decentralised and censorship-resistant.',
  'Check the Sui explorer to verify your on-chain transactions.',
];

function todayTip() {
  const day = new Date().getDay();
  return TIPS[day % TIPS.length];
}

export function TipCard() {
  return (
    <div
      className="rounded-[20px] p-5"
      style={{
        background: 'linear-gradient(135deg, #eef8f4 0%, #d4f5ef 100%)',
        border: '1px solid rgba(145,224,218,0.45)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className="grid h-7 w-7 place-items-center rounded-xl"
          style={{ background: '#124741', color: '#91e0da' }}
        >
          <Lightbulb className="size-4" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#6c8289]">Tip of the day</p>
      </div>
      <p className="text-sm leading-6 text-[#124741]" style={{ fontWeight: 600 }}>
        {todayTip()}
      </p>
    </div>
  );
}
