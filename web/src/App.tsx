import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ChatMessage as ChatMessageComponent } from './components/chat/message';
import { ChatInput } from './components/chat/input';
import { ScrollToBottom } from './components/chat/scroll-to-bottom'; // Assuming this component is created or will be
import { Send, Bot, User, Terminal, FileText, Brain, Code, Sparkles, Database, MessageSquare, Plus, Trash2, ChevronDown, PanelLeftClose, PanelLeftOpen, ChevronLeft, Folder } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextTrigger,
} from './components/ui/context';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  logs?: string[];
  attachments?: any[];
  timestamp: Date;
  stats?: {
    duration: number;
  };
}

interface Skill {
  id: string;
  name: string;
  description: string;
  packId?: string;
}

interface SkillPack {
    id: string;
    name: string;
    description: string;
}

interface Memory {
  id: string;
  content: string;
  type: string;
  tier: string;
  created_at: string;
  metadata?: any;
}

interface Session {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

interface Config {
  model: string;
  provider: string;
  contextWindow: number;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillPacks, setSkillPacks] = useState<SkillPack[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedSkillPackId, setSelectedSkillPackId] = useState<string | null>(null);
  const [selectedMemoryTier, setSelectedMemoryTier] = useState<string>('all');
  const [selectedMemoryType, setSelectedMemoryType] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'session' | 'memory', id: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Simple token estimation: 1 token ~= 4 chars
    const allContent = messages.map(m => m.content).join('');
    setTokenCount(Math.ceil(allContent.length / 4));
  }, [messages]);

  useEffect(() => {
    fetch('/api/skills')
      .then(res => res.json())
      .then(data => {
          setSkills(data);
          // Select first pack by default if available
          if (data.length > 0) {
              const firstPackId = data[0].packId || 'other';
              setSelectedSkillPackId(firstPackId);
          }
      })
      .catch(err => console.error('Failed to fetch skills:', err));

    fetch('/api/skill-packs')
      .then(res => res.json())
      .then(data => setSkillPacks(data))
      .catch(err => console.error('Failed to fetch skill packs:', err));

    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to fetch config:', err));

    const fetchMemories = () => {
        fetch('/api/memories?userId=web-user')
        .then(res => res.json())
        .then(data => setMemories(data))
        .catch(err => console.error('Failed to fetch memories:', err));
    };

    const fetchSessions = () => {
        fetch('/api/sessions?userId=web-user')
        .then(res => res.json())
        .then(data => {
            setSessions(data);
            if (data.length > 0 && !currentSessionId) {
                // Load most recent session
                loadSession(data[0].id);
            }
        })
        .catch(err => console.error('Failed to fetch sessions:', err));
    };

    fetchMemories();
    fetchSessions();
  }, []);

  // Auto-refresh chat history to catch async events (like memory updates)
  useEffect(() => {
    if (!currentSessionId || isConnecting) return;

    const interval = setInterval(() => {
        // Only fetch if not connecting to avoid race conditions or jitter
        fetch(`/api/sessions/${currentSessionId}/history`)
            .then(res => res.json())
            .then(history => {
                // If history length changed, update messages
                // We need to map them first to compare
                // But wait, if we replace messages, we might lose local state like expanded logs if we are not careful.
                // However, we only care about *new* messages.
                
                // Simple check: if server has more messages than local
                if (history.length > messages.length) {
                    const mappedMessages: ChatMessage[] = history.map((msg: any) => ({
                        id: msg.id,
                        role: msg.role === 'assistant' ? 'agent' : msg.role,
                        content: msg.content,
                        timestamp: new Date(msg.timestamp),
                        logs: [] // Logs might be lost if we don't persist them in DB properly or if we reload. 
                                 // For now, persistent logs are not fully implemented in DB schema maybe?
                                 // Actually, agent.chat doesn't save logs to DB, only messages.
                                 // So reloading will wipe logs of *previous* messages.
                                 // We should preserve existing messages and only append new ones.
                    }));
                    
                    // Merge: keep existing messages (with logs) and append new ones
                    setMessages(prev => {
                        // Find messages in history that are NOT in prev
                        const existingIds = new Set(prev.map(m => m.id));
                        const newMsgs = mappedMessages.filter(m => !existingIds.has(m.id));
                        
                        if (newMsgs.length > 0) {
                            return [...prev, ...newMsgs];
                        }
                        return prev;
                    });
                }
            })
            .catch(err => console.error('Background sync failed:', err));
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [currentSessionId, isConnecting, messages.length]);

  const loadSession = async (sessionId: string) => {
      setCurrentSessionId(sessionId);
      try {
          const res = await fetch(`/api/sessions/${sessionId}/history`);
          const history = await res.json();
          const mappedMessages: ChatMessage[] = history.map((msg: any) => ({
              id: msg.id,
              role: msg.role === 'assistant' ? 'agent' : msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
              logs: []
          }));
          setMessages(mappedMessages);
      } catch (err) {
          console.error('Failed to load session history:', err);
      }
  };

  const createNewSession = async () => {
      try {
          const res = await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: 'web-user', title: 'New Chat' })
          });
          const session = await res.json();
          setSessions(prev => [session, ...prev]);
          setCurrentSessionId(session.id);
          setMessages([]);
      } catch (err) {
          console.error('Failed to create session:', err);
      }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'session') {
      try {
        await fetch(`/api/sessions/${deleteTarget.id}`, { method: 'DELETE' });
        setSessions(prev => prev.filter(s => s.id !== deleteTarget.id));
        if (currentSessionId === deleteTarget.id) {
          setMessages([]);
          setCurrentSessionId(null);
        }
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    } else if (deleteTarget.type === 'memory') {
      try {
        await fetch(`/api/memories/${deleteTarget.id}`, { method: 'DELETE' });
        setMemories(prev => prev.filter(m => m.id !== deleteTarget.id));
      } catch (err) {
        console.error('Failed to delete memory:', err);
      }
    }
    
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteTarget({ type: 'session', id: sessionId });
      setDeleteDialogOpen(true);
  };

  const deleteMemory = (memoryId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteTarget({ type: 'memory', id: memoryId });
      setDeleteDialogOpen(true);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleRegenerate = async (msgId: string) => {
      const msgIndex = messages.findIndex(m => m.id === msgId);
      if (msgIndex <= 0) return;
      
      const lastUserMsg = messages[msgIndex - 1];
      if (lastUserMsg.role !== 'user') return;
      
      // Remove all messages after the user message
      setMessages(prev => prev.slice(0, msgIndex));
      
      // Trigger send with the last user message content
      handleSend(lastUserMsg.content);
  };

  const handleSend = async (text: string = input, attachments: any[] = [], webSearch: boolean = false) => {
    if (!text.trim() && attachments.length === 0) return;

    // Check if we are regenerating (text is passed but not from input)
    const isRegenerating = text !== input;
    
    let userMsg: ChatMessage;
    
    // Construct display content for user message
    const displayContent = text;
    // Removed attachments text appending as we now render them separately
    
    if (isRegenerating) {
        // Find existing user message if regenerating
        // For simplicity in this flow, we just don't add a new user message
        // But we need to ensure the state is consistent.
        // The handleRegenerate function already sliced the messages array.
        userMsg = {
            id: uuidv4(), // Placeholder, won't be used
            role: 'user',
            content: displayContent,
            attachments: attachments,
            timestamp: new Date()
        };
    } else {
        userMsg = {
            id: uuidv4(),
            role: 'user',
            content: displayContent,
            attachments: attachments,
            timestamp: new Date()
        };
        // Update state with functional update to ensure reliability
        setMessages(prev => [...prev, userMsg]);
    }

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
    
    // Update state in one go to prevent race conditions or batching issues
    setMessages(prev => [...prev, agentMsg]);
    
    // Clear input immediately if not regenerating
    if (!isRegenerating) {
        setInput('');
    }

    // Force a re-render/scroll before starting the stream
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);

    try {
      // Use the actual text content for the API call
      // const messageText = isRegenerating ? text : userMsg.content; // userMsg.content has extra display info now
      const messageText = text;
      
      let url = `/api/chat/stream?message=${encodeURIComponent(messageText)}&userId=web-user${currentSessionId ? `&sessionId=${currentSessionId}` : ''}`;
      
      if (attachments.length > 0) {
          url += `&attachments=${encodeURIComponent(JSON.stringify(attachments))}`;
      }
      if (webSearch) {
          url += `&webSearch=true`;
      }

      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'token') {
          const content = data.content;
          if (content && content.startsWith('[TITLE_GENERATED]')) {
            const title = content.replace('[TITLE_GENERATED]', '').trim();
            setSessions(prev => prev.map(s => 
              s.id === currentSessionId ? { ...s, title } : s
            ));
          } else {
            setMessages(prev => prev.map(msg => 
              msg.id === agentMsgId 
                ? { ...msg, content: msg.content + content }
                : msg
            ));
          }
        } else if (data.type === 'log') {
          setMessages(prev => prev.map(msg => 
            msg.id === agentMsgId 
              ? { ...msg, logs: [...(msg.logs || []), data.content] }
              : msg
          ));
        } else if (data.type === 'done') {
          eventSource.close();
          setIsConnecting(false);
          // Refresh sessions to get updated title/timestamp
          fetch('/api/sessions?userId=web-user')
            .then(res => res.json())
            .then(data => setSessions(data));
        } else if (data.type === 'stats') {
          setMessages(prev => prev.map(msg => 
            msg.id === agentMsgId 
              ? { ...msg, stats: data.content }
              : msg
          ));
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
    <div className="flex h-screen bg-zinc-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside 
          className={cn(
            "bg-white border-r border-zinc-200 flex flex-col shadow-sm z-20 transition-all duration-300 ease-in-out h-full overflow-hidden",
            isSidebarOpen ? "w-80 translate-x-0 opacity-100" : "w-0 -translate-x-full opacity-0 border-r-0"
          )}
      >
        <div className="h-16 flex items-center px-6 border-b border-zinc-100 shrink-0 justify-between whitespace-nowrap min-w-[20rem]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-200 shadow-lg shrink-0">
              <span className="text-white font-bold">R</span>
            </div>
            <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Redigg</h1>
                <span className="text-[10px] text-zinc-400 font-mono">v0.1.0</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={createNewSession} className="h-8 w-8 text-zinc-500 hover:text-indigo-600">
                <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="h-8 w-8 text-zinc-400 hover:text-zinc-600 md:flex hidden">
                <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 min-w-[20rem]">
          <Tabs defaultValue="chats" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-4 shrink-0">
              <TabsList className="w-full bg-zinc-100 p-1 mb-2 grid grid-cols-4 h-auto">
                  <TabsTrigger value="chats" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title="Chat">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Chat</span>
                  </TabsTrigger>
                  <TabsTrigger value="skills" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title="Skill">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Skill</span>
                  </TabsTrigger>
                  <TabsTrigger value="memory" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title="Mem">
                    <Brain className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Mem</span>
                  </TabsTrigger>
                  <TabsTrigger value="papers" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title="Ref">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Ref</span>
                  </TabsTrigger>
                </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
              
              <TabsContent value="chats" className="mt-0">
                  {sessions.length > 0 ? (
                    <div className="space-y-1">
                      {sessions.map(session => (
                        <button 
                          key={session.id} 
                          className={cn(
                              "w-full text-left p-3 rounded-lg border transition-all group relative pr-8",
                              currentSessionId === session.id 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm' 
                              : 'bg-white border-zinc-100 text-zinc-600 hover:border-indigo-200 hover:text-zinc-900'
                          )}
                          onClick={() => loadSession(session.id)}
                        >
                          <div className="font-medium text-sm line-clamp-1">{session.title || 'New Chat'}</div>
                          <div className="text-[10px] opacity-70 mt-1">{new Date(session.updated_at).toLocaleString()}</div>
                          <div 
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-red-100 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              onClick={(e) => deleteSession(session.id, e)}
                          >
                              <Trash2 className="h-3.5 w-3.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-zinc-400 text-xs">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        No recent chats
                    </div>
                  )}
                </TabsContent>

              <TabsContent value="skills" className="mt-0 flex-1 flex flex-col min-h-0">
                  {skills.length > 0 ? (
                    (() => {
                        const groupedSkills = skills.reduce((acc, skill) => {
                            const packId = skill.packId || 'other';
                            if (!acc[packId]) acc[packId] = [];
                            acc[packId].push(skill);
                            return acc;
                        }, {} as Record<string, Skill[]>);

                        const currentPackId = selectedSkillPackId || Object.keys(groupedSkills)[0];
                        const currentPackSkills = groupedSkills[currentPackId] || [];
                        const currentPack = skillPacks.find(p => p.id === currentPackId);
                        let currentPackName = currentPack ? currentPack.name : (currentPackId === 'other' ? 'Other Skills' : currentPackId);
                        if (currentPackName === 'infra') currentPackName = 'System';
                        else if (currentPackName === 'core') currentPackName = 'Agent';
                        currentPackName = currentPackName.charAt(0).toUpperCase() + currentPackName.slice(1);

                        return (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* Top: Packs List (as Tabs) */}
                                <div className="border-b border-zinc-200 mb-2">
                                    <div className="flex overflow-x-auto scrollbar-hide">
                                        {Object.entries(groupedSkills).map(([packId, packSkills]) => {
                                            const pack = skillPacks.find(p => p.id === packId);
                                            // Capitalize pack name and rename 'infra' to 'System', 'core' to 'Agent'
                                            let packName = pack ? pack.name : (packId === 'other' ? 'Other' : packId);
                                            if (packName === 'infra') packName = 'System';
                                            else if (packName === 'core') packName = 'Agent';
                                            packName = packName.charAt(0).toUpperCase() + packName.slice(1);
                                            
                                            const isSelected = packId === currentPackId;
                                            
                                            return (
                                                <button 
                                                    key={packId}
                                                    className={cn(
                                                        "px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                                                        isSelected 
                                                            ? "border-indigo-500 text-indigo-600" 
                                                            : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                                                    )}
                                                    onClick={() => setSelectedSkillPackId(packId)}
                                                >
                                                    {packName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Bottom: Skills List */}
                                <div className="flex-1 overflow-y-auto pr-1">
                                    <div className="space-y-2 pb-4">
                                        {currentPackSkills.map(skill => (
                                          <button 
                                            key={skill.id} 
                                            className="w-full text-left p-3 rounded-lg border border-zinc-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group animate-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                                            onClick={() => {
                                               if (skill.id === 'literature_review') {
                                                   setInput("Conduct a literature review on: ");
                                               } else if (skill.id === 'code_analysis') {
                                                   setInput("Analyze the codebase structure. Focus on: ");
                                               } else if (skill.id === 'local_file_ops') {
                                                   setInput("Help me organize my local files. specifically: ");
                                               } else {
                                                   setInput(`Use the ${skill.name} skill to help me with: `);
                                               }
                                            }}
                                          >
                                            <div className="flex items-center gap-2 font-medium text-zinc-900 group-hover:text-indigo-600 transition-colors text-sm">
                                              <Sparkles className="h-4 w-4 text-indigo-500" />
                                              {skill.name}
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-1 pl-6 line-clamp-2">{skill.description}</div>
                                          </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                  ) : (
                    <div className="text-center py-8 text-zinc-400 text-xs">
                        Loading skills...
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="memory" className="mt-0">
                  <div className="flex flex-col h-full overflow-hidden">
                      {/* Memory Tiers Tabs */}
                       <div className="border-b border-zinc-200 mb-2">
                           <div className="flex overflow-x-auto scrollbar-hide">
                               {['all', 'working', 'short_term', 'long_term'].map(tier => (
                                   <button 
                                       key={tier}
                                       className={cn(
                                           "px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap capitalize",
                                           selectedMemoryTier === tier
                                               ? "border-indigo-500 text-indigo-600" 
                                               : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                                       )}
                                       onClick={() => setSelectedMemoryTier(tier)}
                                   >
                                       {tier.replace('_', ' ')}
                                   </button>
                               ))}
                           </div>
                       </div>
                       
                       {/* Type Filters */}
                       <div className="px-1 mb-3 flex flex-wrap gap-2">
                           <button
                               type="button"
                               className={cn(
                                   "px-2 py-1 text-[10px] rounded-full border transition-colors capitalize",
                                   selectedMemoryType === null
                                       ? "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800" 
                                       : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                               )}
                               onClick={() => setSelectedMemoryType(null)}
                           >
                               All
                           </button>
                           {['preference', 'fact', 'context'].map(type => (
                               <button
                                   key={type}
                                   className={cn(
                                       "px-2 py-1 text-[10px] rounded-full border transition-colors capitalize",
                                       selectedMemoryType === type
                                           ? type === 'preference' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                             type === 'fact' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                             type === 'context' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                            "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                                   )}
                                   onClick={() => setSelectedMemoryType(type)}
                                >
                                    {type}
                                </button>
                            ))}
                       </div>

                       <div className="flex-1 overflow-y-auto pr-1">
                         <div className="space-y-1">
                             {(() => {
                                 const filteredMemories = memories.filter(m => 
                                     m.type !== 'paper' && 
                                     (selectedMemoryTier === 'all' || m.tier === selectedMemoryTier) &&
                                     (selectedMemoryType === null || m.type === selectedMemoryType)
                                 );
                                 
                                 return filteredMemories.length > 0 ? (
                                 <div className="space-y-2">
                                     {filteredMemories.slice(0, 20).map(m => (
                                     <div key={m.id} className="text-sm p-2.5 bg-white rounded-lg border border-zinc-100 hover:border-indigo-200 transition-colors relative group pr-8">
                                         <div className="font-medium text-zinc-900 leading-snug">{m.content}</div>
                                         <div className="flex items-center gap-2 mt-1.5">
                                         <span className={cn(
                                             "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm border",
                                             m.type === 'preference' ? "bg-purple-50 text-purple-600 border-purple-100" :
                                             m.type === 'fact' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                             m.type === 'context' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                             "bg-zinc-50 text-zinc-500 border-zinc-100"
                                         )}>
                                             {m.type}
                                         </span>
                                         <span className="text-[10px] text-zinc-400">{new Date(m.created_at).toLocaleDateString()}</span>
                                         </div>
                                         <div 
                                             className="absolute right-2 top-2 p-1.5 rounded-md hover:bg-red-100 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                             onClick={(e) => deleteMemory(m.id, e)}
                                         >
                                             <Trash2 className="h-3.5 w-3.5" />
                                         </div>
                                     </div>
                                     ))}
                                 </div>
                                 ) : (
                                 <div className="text-center py-8 text-zinc-400 text-xs">
                                     <Brain className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                     No active mems
                                 </div>
                                 );
                             })()}
                         </div>
                       </div>
                  </div>
                </TabsContent>

                <TabsContent value="papers" className="mt-0">
                  {memories.filter(m => m.type === 'paper').length > 0 ? (
                     <div className="space-y-3">
                       {memories.filter(m => m.type === 'paper').slice(0, 10).map(m => (
                         <div key={m.id} className="text-sm p-3 bg-white rounded-lg border border-zinc-100 hover:border-indigo-200 transition-colors relative group pr-8">
                           <div className="font-medium text-zinc-900 line-clamp-2 leading-snug">{m.metadata?.title || m.content.replace('Paper: ', '')}</div>
                           <div className="flex items-center gap-2 mt-2">
                              <div className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded-full line-clamp-1 max-w-[120px]">
                                 {m.metadata?.authors?.join(', ') || 'Unknown Author'}
                              </div>
                              <span className="text-[10px] text-zinc-400">{new Date(m.created_at).toLocaleDateString()}</span>
                           </div>
                           {m.metadata?.url && (
                             <a href={m.metadata.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-2 flex items-center gap-1">
                               View Paper <FileText className="h-3 w-3" />
                             </a>
                           )}
                           <div 
                               className="absolute right-2 top-2 p-1.5 rounded-md hover:bg-red-100 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                               onClick={(e) => deleteMemory(m.id, e)}
                           >
                               <Trash2 className="h-3.5 w-3.5" />
                           </div>
                         </div>
                       ))}
                     </div>
                  ) : (
                    <div className="text-center py-8 text-zinc-400 text-xs">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        No refs loaded
                    </div>
                  )}
                </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <div className="group relative flex items-center gap-2 px-2 py-1 bg-white/50 rounded-full border border-zinc-200/50 shadow-sm cursor-help">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-medium text-zinc-600">Gateway Online</span>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        Gateway URL: {window.location.origin}
                        <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-zinc-800"></div>
                    </div>
                </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white relative transition-all duration-300">
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the {deleteTarget?.type === 'session' ? 'chat session' : 'memory item'}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Mobile Sidebar Toggle */}
          <div className="absolute top-4 left-4 z-20">
             <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={cn(
                  "h-8 w-8 text-zinc-400 hover:text-zinc-600 shadow-sm transition-all",
                  isSidebarOpen ? "bg-transparent border-0 opacity-0 pointer-events-none" : "bg-white border border-zinc-200 opacity-100"
                )}
             >
                <PanelLeftOpen className="h-4 w-4" />
             </Button>
          </div>

          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 scroll-smooth relative scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
            <div className="sticky top-0 z-10 flex justify-end pointer-events-none p-4">
                {config && (
                    <div className="bg-white/80 backdrop-blur-sm border border-zinc-200 rounded-full px-3 py-1.5 text-xs text-zinc-500 shadow-sm flex items-center gap-3">
                        <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                            {config.model}
                            <ChevronDown className="h-3 w-3 text-zinc-400" />
                        </span>
                    </div>
                )}
            </div>

            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-8 pb-20">
                <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 shadow-sm">
                  <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
                    <span className="text-white font-bold text-2xl">R</span>
                  </div>
                </div>
                <div className="text-center space-y-2 max-w-md px-4">
                  <h3 className="text-xl font-semibold text-zinc-900">How can I help you research?</h3>
                  <p className="text-zinc-500">I can analyze codebases, perform literature reviews, and organize your research materials.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full px-4">
                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-4 px-4 border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-zinc-600"
                    onClick={() => setInput("Conduct a literature review on: ")}
                  >
                    <FileText className="h-5 w-5 mr-3 text-indigo-500" />
                    <div className="text-left">
                      <div className="font-medium text-zinc-900">Literature Review</div>
                      <div className="text-xs text-zinc-400 font-normal mt-0.5">Search and summarize papers</div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-4 px-4 border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-zinc-600"
                    onClick={() => setInput("Analyze the codebase structure. Focus on: ")}
                  >
                    <Code className="h-5 w-5 mr-3 text-indigo-500" />
                    <div className="text-left">
                      <div className="font-medium text-zinc-900">Analyze Code</div>
                      <div className="text-xs text-zinc-400 font-normal mt-0.5">Scan project structure</div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-4 px-4 border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-zinc-600"
                    onClick={() => setInput("Help me organize my local files. specifically: ")}
                  >
                    <Database className="h-5 w-5 mr-3 text-indigo-500" />
                    <div className="text-left">
                      <div className="font-medium text-zinc-900">Organize Files</div>
                      <div className="text-xs text-zinc-400 font-normal mt-0.5">Manage local PDFs</div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-4 px-4 border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-zinc-600"
                    onClick={() => setInput("Create a new research agent named: ")}
                  >
                    <Bot className="h-5 w-5 mr-3 text-indigo-500" />
                    <div className="text-left">
                      <div className="font-medium text-zinc-900">New Agent</div>
                      <div className="text-xs text-zinc-400 font-normal mt-0.5">Create specialized sub-agent</div>
                    </div>
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-6 pb-4">
                {messages.map((msg, index) => (
                  <ChatMessageComponent
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    isThinking={isConnecting && msg.id === messages[messages.length - 1].id && msg.role === 'agent' && !msg.content}
                    logs={msg.logs}
                    stats={msg.stats}
                    attachments={msg.attachments}
                    onCopy={() => handleCopy(msg.content)}
                    onRegenerate={() => {
                        // Allow regenerating any agent message
                        if (msg.role === 'agent' && !isConnecting) {
                            // Find the user message before this
                            const prevMsg = messages[index - 1];
                            if (prevMsg && prevMsg.role === 'user') {
                                // Remove this agent message and all subsequent messages
                                setMessages(prev => prev.slice(0, index));
                                // Trigger send again with user content
                                handleSend(prevMsg.content);
                            }
                        }
                    }}
                  />
                ))}
                <div ref={messagesEndRef} />
            </div>
            {/* Scroll to bottom button */}
            {chatContainerRef.current && (
                <div className="sticky bottom-4 w-full flex justify-center pointer-events-none z-20">
                    <div className="pointer-events-auto">
                        <ScrollToBottom 
                            containerRef={chatContainerRef as React.RefObject<HTMLDivElement>} 
                            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>} 
                        />
                    </div>
                </div>
            )}
          </div>

          <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-zinc-100 shrink-0">
            <div className="max-w-3xl mx-auto w-full">
                <ChatInput 
                    onSubmit={handleSend} 
                    isLoading={isConnecting} 
                    placeholder="Ask a question about your research..." 
                    value={input}
                    onChange={setInput}
                />
                <div className="flex justify-center mt-3">
                    <Context 
                        usedTokens={tokenCount} 
                        maxTokens={config?.contextWindow || 16384} 
                        modelId={config?.model || 'gpt-3.5-turbo'}
                        usage={{
                            promptTokens: tokenCount,
                            completionTokens: messages.reduce((acc, msg) => acc + (msg.role === 'agent' ? Math.ceil(msg.content.length / 4) : 0), 0),
                            totalTokens: tokenCount
                        }}
                    >
                        <ContextTrigger />
                        <ContextContent>
                            <ContextContentHeader />
                            <ContextContentBody>
                                <ContextInputUsage />
                                <ContextOutputUsage />
                            </ContextContentBody>
                            <ContextContentFooter />
                        </ContextContent>
                    </Context>
                </div>
            </div>
          </div>
      </main>
    </div>
  );
}

export default App;
