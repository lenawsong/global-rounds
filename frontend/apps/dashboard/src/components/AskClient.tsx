'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createApiClient } from '../lib/api';
import { Badge, Button, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';

const api = createApiClient();

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export function AskClient() {
  const [input, setInput] = React.useState('Which claims need documentation?');
  const [chat, setChat] = React.useState<ChatMsg[]>([]);
  const { data: snapshot } = useQuery({ queryKey: ['dashboard-snapshot'], queryFn: () => api.getDashboardSnapshot() });

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const messages = [
        { role: 'user' as const, content: question }
      ];
      const res = await api.askDashboard({ messages, context: { data: snapshot }, model: null });
      return res.message;
    },
    onSuccess: (message) => {
      setChat((prev) => [...prev, { role: 'assistant', content: message.content }]);
    }
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    setChat((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    askMutation.mutate(question);
  }

  return (
    <Shell
      title="Ask the Dashboard"
      description="LLM‑assisted Q&A over live operational context."
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' },
        { key: 'ask', label: 'Ask', href: '/ask' }
      ]}
      activeTab="ask"
    >
      <section className="grid gap-6">
        <Card>
          <CardTitle>Chat</CardTitle>
          <CardSubtle>Ask for summaries, outliers, or next actions. Context is pulled from the latest rail snapshot.</CardSubtle>
          <CardBody>
            <div className="grid gap-4">
              <div className="h-[380px] overflow-auto rounded-2xl border border-slate-200/70 bg-white/80 p-4">
                {!chat.length ? (
                  <p className="text-sm text-slate-500">Try: “Which claims need documentation?”</p>
                ) : (
                  <ul className="space-y-3">
                    {chat.map((m, i) => (
                      <li key={i} className={m.role === 'user' ? 'text-slate-800' : 'text-slate-700'}>
                        <Badge variant={m.role === 'user' ? 'brand' : 'neutral'} className="mr-2">
                          {m.role === 'user' ? 'You' : 'Assistant'}
                        </Badge>
                        <span className="align-middle whitespace-pre-wrap">{m.content}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <form onSubmit={submit} className="flex gap-3">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about ops, finance, or inventory…"
                />
                <Button type="submit" disabled={askMutation.isLoading}>{askMutation.isLoading ? 'Thinking…' : 'Send'}</Button>
              </form>
            </div>
          </CardBody>
        </Card>
      </section>
    </Shell>
  );
}

