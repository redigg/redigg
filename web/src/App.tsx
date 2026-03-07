import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Send, Bot, User, Terminal, FileText, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  logs?: string[];
  timestamp: Date;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsConnecting(true);

    // Create a placeholder agent message
    const agentMsgId = uuidv4();
    const agentMsg: ChatMessage = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      logs: [],
      timestamp: new Date()
    };
    setMessages(prev => [...prev, agentMsg]);

    try {
      const eventSource = new EventSource(`http://localhost:4000/api/chat/stream?message=${encodeURIComponent(userMsg.content)}&userId=web-user`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'token') {
          setMessages(prev => prev.map(msg => 
            msg.id === agentMsgId 
              ? { ...msg, content: msg.content + data.content }
              : msg
          ));
        } else if (data.type === 'log') {
          setMessages(prev => prev.map(msg => 
            msg.id === agentMsgId 
              ? { ...msg, logs: [...(msg.logs || []), data.content] }
              : msg
          ));
        } else if (data.type === 'done') {
          eventSource.close();
          setIsConnecting(false);
        } else if (data.type === 'error') {
          console.error('SSE Error:', data.content);
          eventSource.close();
          setIsConnecting(false);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        eventSource.close();
        setIsConnecting(false);
      };

    } catch (err) {
      console.error('Failed to setup SSE:', err);
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">R</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Redigg Agent</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full bg-green-500`} />
            Online
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-12 gap-6">
        {/* Left Sidebar: Memories & Skills */}
        <div className="col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5" />
                Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm p-2 bg-zinc-100 rounded border border-zinc-200">
                <div className="font-medium">Literature Review</div>
                <div className="text-xs text-zinc-500">Search arXiv & Summarize</div>
              </div>
              <div className="text-sm p-2 bg-zinc-100 rounded border border-zinc-200">
                <div className="font-medium">Local File Ops</div>
                <div className="text-xs text-zinc-500">Manage PDF files</div>
              </div>
              <div className="text-sm p-2 bg-zinc-100 rounded border border-zinc-200">
                <div className="font-medium">Skill Evolution</div>
                <div className="text-xs text-zinc-500">Self-learning system</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Recent Papers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-500 text-center py-4">
                Use "Do a literature review..." to fetch papers.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Area */}
        <div className="col-span-9 flex flex-col h-[calc(100vh-8rem)]">
          <Card className="flex-1 flex flex-col shadow-sm border-zinc-200 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4">
                  <Terminal className="h-12 w-12 opacity-20" />
                  <p>Start researching by typing a query below.</p>
                  <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                    <Button variant="outline" size="sm" onClick={() => setInput("Do a literature review on LLM reasoning")}>
                      "Review LLM reasoning"
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setInput("Organize my PDF files")}>
                      "Organize files"
                    </Button>
                  </div>
                </div>
              )}
              
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-zinc-900 text-white' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`rounded-lg px-4 py-3 max-w-[80%] text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert ${
                    msg.role === 'user' 
                      ? 'bg-zinc-900 text-white' 
                      : 'bg-zinc-50 border border-zinc-100 text-zinc-800'
                  }`}>
                    {msg.logs && msg.logs.length > 0 && (
                      <div className="mb-2 p-2 bg-zinc-100 rounded text-xs text-zinc-500 font-mono border border-zinc-200 max-h-32 overflow-y-auto">
                        {msg.logs.map((log, i) => (
                          <div key={i}>{log}</div>
                        ))}
                      </div>
                    )}
                    {msg.role === 'agent' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-zinc-100">
              <form 
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Redigg to research something..."
                  className="flex-1"
                  disabled={isConnecting}
                />
                <Button type="submit" disabled={isConnecting || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default App;
