import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ChatMessage as ChatMessageComponent } from './components/chat/message';
import { ChatInput } from './components/chat/input';
import { ScrollToBottom } from './components/chat/scroll-to-bottom';
import { Sparkles, MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeftOpen, FileText, Brain } from 'lucide-react';
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
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

interface Action {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  output?: any;
  status: 'running' | 'success' | 'error';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  thinking?: string;
  actions?: Action[];
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
  readme?: string;
  usage?: { used: number, success: number, failed: number };
}

interface SkillPack {
    id: string;
    name: string;
    description: string;
}

interface Session {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'running' | 'stopped';
}

interface Config {
  model: string;
  provider: string;
  contextWindow: number;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [inputFocusNonce, setInputFocusNonce] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillPacks, setSkillPacks] = useState<SkillPack[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedSkillPackId, setSelectedSkillPackId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'session' | 'all_sessions', id?: string } | null>(null);
  const [skillPreviewOpen, setSkillPreviewOpen] = useState(false);
  const [skillPreview, setSkillPreview] = useState<{ skill: Skill; snippet: string } | null>(null);
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState<{ title: string; content: string } | null>(null);

  const [uiLang, setUiLang] = useState<'en' | 'zh'>(() => {
    try {
      const stored = localStorage.getItem('uiLang');
      return stored === 'zh' ? 'zh' : 'en';
    } catch {
      return 'en';
    }
  });
  
  useEffect(() => {
    try {
      localStorage.setItem('uiLang', uiLang);
    } catch {}
  }, [uiLang]);

  const t = uiLang === 'zh'
    ? {
        tabs: { chats: '聊天', skills: '技能' },
        newChat: '新对话',
        noRecentChats: '暂无对话',
        loadingSkills: '加载技能中...',
        gatewayOnline: '网关在线',
        gatewayUrl: '网关地址',
        deleteTitle: '确定删除？',
        deleteDescSession: '此操作不可撤销，将永久删除该会话。',
        cancel: '取消',
        delete: '删除',
        clearAllChats: '清空全部聊天',
        clearAllChatsDesc: '此操作不可撤销，将永久删除所有会话。',
        homeTitle: '我可以如何帮助你？',
        homeSubtitle: '从下面的示例开始吧。',
        examples: {
          litReview: {
            title: '请对[主题]做一份文献综述。',
            subtitle: '→ 生成论文摘要和列表。',
            prompt: '请对[主题]做一份文献综述。',
          },
          explain: {
            title: '请解释一下[主题]的概念。',
            subtitle: '→ 提供详细的概念解释。',
            prompt: '请解释一下[主题]的概念。',
          },
          analyzePaper: {
            title: '请分析这篇论文：[标题]',
            subtitle: '→ 深入分析特定论文。',
            prompt: '请分析这篇论文：[标题]',
          },
          autoResearch: {
            title: '自动研究：[主题]（3轮）',
            subtitle: '→ 经过 3 轮自我优化后生成一份精炼的 PDF 报告。',
            prompt: '自动研究：[主题]（3轮）',
          },
        },
      }
    : {
        tabs: { chats: 'Chat', skills: 'Skill' },
        newChat: 'New Chat',
        noRecentChats: 'No recent chats',
        loadingSkills: 'Loading skills...',
        gatewayOnline: 'Gateway Online',
        gatewayUrl: 'Gateway URL',
        deleteTitle: 'Are you sure?',
        deleteDescSession: 'This action cannot be undone. This will permanently delete the chat session.',
        cancel: 'Cancel',
        delete: 'Delete',
        clearAllChats: 'Clear Chats',
        clearAllChatsDesc: 'This action cannot be undone. This will permanently delete all chat sessions.',
        homeTitle: 'How can I help you research?',
        homeSubtitle: 'Try one of these examples to get started.',
        examples: {
          litReview: {
            title: 'Perform a literature review on [Topic].',
            subtitle: '-> Generates a paper list with concise summaries.',
            prompt: 'Perform a literature review on [Topic].',
          },
          explain: {
            title: 'Explain the concept of [Topic].',
            subtitle: '-> Provides a detailed, structured explanation.',
            prompt: 'Explain the concept of [Topic].',
          },
          analyzePaper: {
            title: 'Analyze this paper: [Title]',
            subtitle: '-> Deep-dives into a specific paper.',
            prompt: 'Analyze this paper: [Title]',
          },
          autoResearch: {
            title: 'Auto-research: [Topic] (3 iterations)',
            subtitle: '-> Refines over 3 iterations and produces a polished PDF report.',
            prompt: 'Auto-research: [Topic] (3 iterations)',
          },
        },
      };

  const randomTopics = [
    'multi-agent reinforcement learning',
    'world models for planning',
    'retrieval-augmented generation',
    'diffusion models for generation',
    'LLM alignment and safety',
    'agentic tool use and planning',
    'graph neural networks',
    'causal representation learning',
    'offline reinforcement learning',
    'multi-modal foundation models',
    'self-supervised learning',
    'continual learning',
  ];

  const randomTopicsZh = [
    '多智能体强化学习',
    '世界模型与规划',
    '检索增强生成',
    '扩散模型',
    '对齐与安全',
    '工具调用与规划',
    '图神经网络',
    '因果表征学习',
    '离线强化学习',
    '多模态基础模型',
    '自监督学习',
    '持续学习',
  ];

  const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

  const fillExamplePrompt = (template: string) => {
    const topic = uiLang === 'zh' ? pickRandom(randomTopicsZh) : pickRandom(randomTopics);
    const title = uiLang === 'zh'
      ? pickRandom([
          `《${topic}综述》`,
          `《${topic}：方法与进展》`,
          `《${topic}：系统性回顾》`,
          `《${topic}：基准、数据集与评测》`,
        ])
      : pickRandom([
          `A Survey of ${topic}`,
          `${topic}: A Comprehensive Review`,
          `Recent Advances in ${topic}`,
          `Benchmarking ${topic}: Methods and Metrics`,
        ]);

    return template
      .replaceAll('[Topic]', topic)
      .replaceAll('[Title]', title)
      .replaceAll('[主题]', topic)
      .replaceAll('[标题]', title);
  };

  const gatewayBaseUrl = import.meta.env.VITE_GATEWAY_URL || (import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin);
  
  // Notification State
  const [unseenSessionIds, setUnseenSessionIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef(true);

  // Track scroll position to determine if we should auto-scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
        const { scrollHeight, scrollTop, clientHeight } = container;
        // If user is within 100px of bottom, enable auto-scroll
        const distance = scrollHeight - scrollTop - clientHeight;
        isAutoScrollEnabled.current = distance < 100;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const buildSkillSnippet = (skill: Skill) => {
    const skillName = skill.name || skill.id;
    
    if (skill.id === 'literature_review') {
      return `Use the ${skillName} skill to conduct a comprehensive literature review on: [your topic here]`;
    }
    if (skill.id === 'paper_search') {
      return `Use the ${skillName} skill to search for papers about: [your topic here]`;
    }
    if (skill.id === 'code_analysis') {
      return `Use the ${skillName} skill to analyze the codebase. Focus on: [specific area or question]`;
    }
    if (skill.id === 'local_file_ops') {
      return `Use the ${skillName} skill to help me organize my local files: [describe your goal]`;
    }
    if (skill.id === 'bibtex_manager') {
      return `Use the ${skillName} skill to manage my BibTeX references: [describe what you need]`;
    }

    return `Use the ${skillName} skill to help me with: [your request here]`;
  };

  useEffect(() => {
    // Auto-scroll if enabled
    if (isAutoScrollEnabled.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
        // Edge case: If it's the very first message or loading history, we might want to force scroll?
        // But logic above handles "default true".
    }
    
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

    const fetchSessions = () => {
        fetch('/api/sessions?userId=web-user')
        .then(res => res.json())
        .then(data => {
            setSessions(data);
            // Only auto-load if user has never selected a session (first visit)
            // Don't auto-load during polling to avoid jumping around
            if (data.length > 0 && !currentSessionId && !hasSelectedSession.current) {
                loadSession(data[0].id);
            }
            
            // Check for unseen sessions (updated_at > lastRead)
            // We need to store lastRead per session in localStorage
            // Format: { [sessionId]: timestamp }
            try {
                const lastReadMap = JSON.parse(localStorage.getItem('sessionLastReadMap') || '{}');
                const newUnseen = new Set<string>();
                
                data.forEach((session: Session) => {
                    const lastRead = lastReadMap[session.id] ? new Date(lastReadMap[session.id]) : new Date(0);
                    const updated = new Date(session.updated_at);
                    // Add a small buffer or check equality if updated_at is reliable
                    if (updated > lastRead && session.id !== currentSessionId) {
                         newUnseen.add(session.id);
                    }
                });
                setUnseenSessionIds(newUnseen);
            } catch (e) {
                console.error('Error parsing session read state', e);
            }
        })
        .catch(err => console.error('Failed to fetch sessions:', err));
    };

    fetchSessions();
    
    // Poll for updates (Sessions) to update notification dots
    const pollInterval = setInterval(() => {
        // We only poll sessions if we want to see dots appear for *other* sessions while chatting
        // Since `loadSession` is polled separately for the current session, this is for the sidebar list.
        fetchSessions(); 
    }, 10000); // Poll every 10s for sidebar updates
    
    return () => clearInterval(pollInterval);
  }, []); // Only run once on mount (and setup polling)

  // Update last read when switching sessions
  useEffect(() => {
      if (currentSessionId) {
          // Mark current session as read
          setUnseenSessionIds(prev => {
              const next = new Set(prev);
              next.delete(currentSessionId);
              return next;
          });
          
          // Update localStorage
          const lastReadMap = JSON.parse(localStorage.getItem('sessionLastReadMap') || '{}');
          lastReadMap[currentSessionId] = new Date().toISOString();
          localStorage.setItem('sessionLastReadMap', JSON.stringify(lastReadMap));
      }
  }, [currentSessionId, messages]); // Update when messages change too (user is viewing them)



  // Auto-refresh chat history to catch async events (like memory updates)
  // DISABLED: This overwrites thinking content during streaming
  // useEffect(() => {
  //   if (!currentSessionId) return;
  //   const interval = setInterval(() => {
  //       loadSession(currentSessionId);
  //   }, 3000);
  //   return () => clearInterval(interval);
  // }, [currentSessionId, isConnecting]);

  const loadSession = async (sessionId: string) => {
      setCurrentSessionId(sessionId);
      try {
          const res = await fetch(`/api/sessions/${sessionId}/history`);
          const history = await res.json();
          
          const reconstructedMessages: ChatMessage[] = [];
          
          for (const msg of history) {
              if (msg.role === 'user') {
                  reconstructedMessages.push({
                      id: msg.id,
                      role: 'user',
                      content: msg.content,
                      attachments: msg.metadata?.attachments,
                      timestamp: new Date(msg.timestamp)
                  });
              } else if (msg.role === 'assistant') {
                  reconstructedMessages.push({
                      id: msg.id,
                      role: 'agent',
                      content: msg.content,
                      thinking: msg.thinking || undefined,
                      actions: msg.actions || undefined,
                      attachments: msg.metadata?.attachments,
                      timestamp: new Date(msg.timestamp)
                  });
              }
          }
          
          setMessages(reconstructedMessages);
      } catch (err) {
          console.error('Failed to load session history:', err);
      }
  };

  const createNewSession = async () => {
      try {
          const res = await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: 'web-user', title: t.newChat })
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

    if (deleteTarget.type === 'all_sessions') {
      try {
        await fetch(`/api/sessions?userId=web-user`, { method: 'DELETE' });
        setSessions([]);
        setMessages([]);
        setCurrentSessionId(null);
      } catch (err) {
        console.error('Failed to delete all sessions:', err);
      }
    } else if (deleteTarget.type === 'session') {
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
    }
    
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteTarget({ type: 'session', id: sessionId });
      setDeleteDialogOpen(true);
  };

  const clearAllSessions = () => {
      setDeleteTarget({ type: 'all_sessions' });
      setDeleteDialogOpen(true);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasSelectedSession = useRef(false);

  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setIsConnecting(false);
      
      // Also notify backend to stop
      if (currentSessionId) {
          fetch(`/api/sessions/${currentSessionId}/stop`, { method: 'POST' })
            .catch(err => console.error('Failed to stop session:', err));
      }
  };

  const handleSend = async (text: string = input, attachments: any[] = [], webSearch: boolean = false, autoMode: boolean = false) => {
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
    }, 50); // Increased delay slightly to ensure render

    try {
      // Use the actual text content for the API call
      // const messageText = isRegenerating ? text : userMsg.content; // userMsg.content has extra display info now
      const messageText = text;
      
      const res = await fetch('/api/chat/async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              message: messageText,
              userId: 'web-user',
              sessionId: currentSessionId,
              webSearch,
              attachments,
              autoMode
          })
      });

      if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
      }

      setIsConnecting(true); // Keep connecting true during SSE stream
      
      // Start listening to SSE events for this session
      const lastEventId = window.localStorage.getItem(`redigg:lastEventId:${currentSessionId!}`) || '0';
      const eventSource = new EventSource(`/api/sessions/${currentSessionId!}/events?since=${encodeURIComponent(lastEventId)}`);
      
      // Store controller for stopping. 
      // Note: EventSource doesn't use AbortController directly, but we can wrap it.
      // Or we just store the EventSource instance to close it.
      // But we also need to tell the backend to stop processing?
      // For now, let's just close the connection on the frontend.
      // The backend might continue running, but the UI stops.
      // Ideally, we send a cancellation request.
      
      // We can use AbortController to wrap the whole "session" concept in our mind, 
      // but practically we just need to close the EventSource.
      // Let's repurpose the ref to hold the stop function.
      abortControllerRef.current = {
          abort: () => {
              eventSource.close();
              // Optional: Send cancellation to backend
              // fetch(`/api/sessions/${currentSessionId}/cancel`, { method: 'POST' });
          }
      } as any;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (event.lastEventId) {
          window.localStorage.setItem(`redigg:lastEventId:${currentSessionId!}`, event.lastEventId);
        }
        
        if (data.type === 'session_title') {
          const title = data.content?.title;
          if (typeof title === 'string' && title.trim()) {
            setSessions(prev => prev.map(s =>
              s.id === currentSessionId ? { ...s, title: title.trim() } : s
            ));
          }
        } else if (data.type === 'stats') {
          setMessages(prev => prev.map(msg =>
            msg.id === agentMsgId
              ? { ...msg, stats: data.content }
              : msg
          ));
        } else if (data.type === 'token') {
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
        } else if (data.type === 'thinking') {
            const content = data.content;
            console.log('[App] thinking received:', content.substring(0, 50), 'length:', content.length);
            setMessages(prev => {
              const updated = prev.map(msg => 
                msg.id === agentMsgId 
                  ? { ...msg, thinking: (msg.thinking || '') + content } 
                  : msg
              );
              console.log('[App] after thinking update, thinking length:', updated.find(m => m.id === agentMsgId)?.thinking?.length);
              return updated;
            });
        } else if (data.type === 'action') {
            const action = data.content;
            console.log('[App] action received:', action.id, action.name, 'current thinking length:', messages.find(m => m.id === agentMsgId)?.thinking?.length);
            setMessages(prev => prev.map(msg => {
                if (msg.id === agentMsgId) {
                    const existingActions = msg.actions || [];
                    const index = existingActions.findIndex((a: Action) => a.id === action.id);
                    let newActions;
                    if (index >= 0) {
                        newActions = [...existingActions];
                        newActions[index] = { ...newActions[index], ...action };
                    } else {
                        newActions = [...existingActions, action];
                    }
                    console.log('[App] updating action, thinking:', msg.thinking?.substring(0, 50), 'actions count:', newActions.length);
                    return { ...msg, actions: newActions, thinking: msg.thinking };
                }
                return msg;
            }));
        } else if (data.type === 'done') {
          eventSource.close();
          setIsConnecting(false);
          
          // Refresh sessions after completion
          fetch(`/api/sessions?userId=web-user`)
            .then(res => res.json())
            .then(data => setSessions(data));
        } else if (data.type === 'error') {
          console.error('SSE Error:', data.content);
          eventSource.close();
          setIsConnecting(false);
        } else if (data.type === 'ping') {
            // Keep alive
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        eventSource.close();
        // Fallback to polling handled by useEffect
      };

    } catch (err) {
      console.error('Failed to send message:', err);
      setIsConnecting(false);
      
      // Remove the placeholder user message on error
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
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
            <img src="/favicons/favicon-256x256.ico" alt="Redigg" className="h-8 w-8 rounded-lg shadow-indigo-200 shadow-lg shrink-0" />
            <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Redigg</h1>
                <span className="text-[10px] text-zinc-400 font-mono">v0.1.5</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={createNewSession} className="h-8 w-8 text-zinc-500 hover:text-indigo-600" title={t.newChat}>
                <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={clearAllSessions} className="h-8 w-8 text-zinc-400 hover:text-red-600" title={t.clearAllChats}>
                <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="h-8 w-8 text-zinc-400 hover:text-zinc-600 md:flex hidden">
                <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 min-w-[20rem]">
          <Tabs defaultValue="chats" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-4 shrink-0">
              <TabsList className="w-full bg-zinc-100 p-1 mb-2 grid grid-cols-2 h-auto">
                  <TabsTrigger value="chats" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm relative" title="Chat">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{t.tabs.chats}</span>
                    {unseenSessionIds.size > 0 && (
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="skills" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title="Skill">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{t.tabs.skills}</span>
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
                          onClick={() => {
                            hasSelectedSession.current = true;
                            loadSession(session.id);
                          }}
                        >
                          <div className="font-medium text-sm flex items-center gap-2 w-full min-w-0">
                              <span className="truncate flex-1">{session.title || t.newChat}</span>
                              {unseenSessionIds.has(session.id) && (
                                  <span className="h-2 w-2 rounded-full bg-red-500 shrink-0"></span>
                              )}
                          </div>
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
                        {t.noRecentChats}
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
                                        {Object.entries(groupedSkills)
                                            .filter(([packId, _]) => packId !== 'other')
                                            .map(([packId, _]) => {
                                            const pack = skillPacks.find(p => p.id === packId);
                                            let packName = pack ? pack.name : packId;
                                            if (packName === 'infra') packName = 'System';
                                            else if (packName === 'core') packName = 'Agent';
                                            // Remove number prefix like "01-", "02-"
                                            packName = packName.replace(/^\d{2}-/, '');
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
                                               const snippet = buildSkillSnippet(skill);
                                               setSkillPreview({ skill, snippet });
                                               setSkillPreviewOpen(true);
                                            }}
                                          >
                                            <div className="flex items-center gap-2 font-medium text-zinc-900 group-hover:text-indigo-600 transition-colors text-sm">
                                              <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
                                              <span className="truncate">{skill.name}</span>
                                              {skill.usage && skill.usage.used > 0 && (
                                                  <span className="ml-auto shrink-0 text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded font-mono">
                                                    {skill.usage.used}×
                                                  </span>
                                              )}
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
                        {t.loadingSkills}
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
                    <span className="text-xs font-medium text-zinc-600">{t.gatewayOnline}</span>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {t.gatewayUrl}: {gatewayBaseUrl}
                        <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-zinc-800"></div>
                    </div>
                </div>
          </div>
          <LanguageSwitcher value={uiLang} onValueChange={setUiLang} />
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white relative transition-all duration-300">
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
                <AlertDialogDescription>
          {/* Removed memory delete target logic for now */}
          {deleteTarget?.type === 'all_sessions'
            ? t.clearAllChatsDesc
            : t.deleteDescSession}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteTarget(null)}>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">{t.delete}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={skillPreviewOpen}
            onOpenChange={(open) => {
              setSkillPreviewOpen(open);
              if (!open) {
                setSkillPreview(null);
              }
            }}
          >
            <AlertDialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  {skillPreview ? skillPreview.skill.name : 'Skill'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {skillPreview?.skill.description}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
                <div className="prose prose-zinc prose-sm max-w-none p-4 dark:prose-invert">
                  {skillPreview?.skill.readme ? (
                    <div className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">
                      {skillPreview.skill.readme}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500 italic">
                      No documentation available.
                    </div>
                  )}
                </div>
              </div>

              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (!skillPreview) return;
                    setInput(skillPreview.snippet);
                    setSkillPreviewOpen(false);
                    setInputFocusNonce((n) => n + 1);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-600"
                >
                  Use
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Markdown Preview Dialog */}
          <AlertDialog
            open={markdownPreviewOpen}
            onOpenChange={(open) => {
              setMarkdownPreviewOpen(open);
              if (!open) {
                setMarkdownPreview(null);
              }
            }}
          >
            <AlertDialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-500" />
                  {markdownPreview?.title || 'Document'}
                </AlertDialogTitle>
              </AlertDialogHeader>

              <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
                <div className="prose prose-zinc prose-sm max-w-none p-6 dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {markdownPreview?.content || ''}
                  </ReactMarkdown>
                </div>
              </div>

              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel>Close</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!markdownPreview) return;
                    // Generate PDF
                    const response = await fetch('/api/generate-pdf', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        title: markdownPreview.title, 
                        content: markdownPreview.content 
                      })
                    });
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${markdownPreview.title}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600"
                >
                  Generate PDF
                </AlertDialogAction>
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
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-8 pb-20">
                <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 shadow-sm">
                  <img src="/favicons/favicon-256x256.ico" alt="Redigg" className="h-16 w-16 rounded-xl shadow-indigo-200 shadow-lg" />
                </div>
                <div className="text-center space-y-2 max-w-md px-4">
                  <h3 className="text-xl font-semibold text-zinc-900">{t.homeTitle}</h3>
                  <p className="text-zinc-500">{t.homeSubtitle}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full px-4">
                  <Button 
                    variant="outline" 
                    className="justify-start items-start whitespace-normal h-auto py-4 px-4 border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-zinc-600"
                    onClick={() => setInput(fillExamplePrompt(t.examples.litReview.prompt))}
                  >
                    <FileText className="h-5 w-5 mr-3 text-indigo-500 shrink-0" />
                    <div className="text-left min-w-0 flex-1">
                      <div className="font-medium text-zinc-900 whitespace-normal break-words">{t.examples.litReview.title}</div>
                      <div className="text-xs text-zinc-400 font-normal mt-0.5">{t.examples.litReview.subtitle}</div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="justify-start items-start whitespace-normal h-auto py-4 px-4 border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-zinc-600"
                    onClick={() => setInput(fillExamplePrompt(t.examples.explain.prompt))}
                  >
                    <Brain className="h-5 w-5 mr-3 text-indigo-500 shrink-0" />
                    <div className="text-left min-w-0 flex-1">
                      <div className="font-medium text-zinc-900 whitespace-normal break-words">{t.examples.explain.title}</div>
                      <div className="text-xs text-zinc-400 font-normal mt-0.5">{t.examples.explain.subtitle}</div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start items-start whitespace-normal h-auto py-4 px-4 border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-zinc-600"
                    onClick={() => setInput(fillExamplePrompt(t.examples.analyzePaper.prompt))}
                  >
                    <FileText className="h-5 w-5 mr-3 text-indigo-500 shrink-0" />
                    <div className="text-left min-w-0 flex-1">
                      <div className="font-medium text-zinc-900 whitespace-normal break-words">{t.examples.analyzePaper.title}</div>
                      <div className="text-xs text-zinc-400 font-normal mt-0.5">{t.examples.analyzePaper.subtitle}</div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start items-start whitespace-normal h-auto py-4 px-4 border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-zinc-600"
                    onClick={() => setInput(fillExamplePrompt(t.examples.autoResearch.prompt))}
                  >
                    <Sparkles className="h-5 w-5 mr-3 text-indigo-500 shrink-0" />
                    <div className="text-left min-w-0 flex-1">
                      <div className="font-medium text-zinc-900 whitespace-normal break-words">{t.examples.autoResearch.title}</div>
                      <div className="text-xs text-zinc-400 font-normal mt-0.5">{t.examples.autoResearch.subtitle}</div>
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
                    thinking={msg.thinking}
                    actions={msg.actions}
                    isThinking={msg.role === 'agent' && isConnecting && index === messages.length - 1}
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
                    onStop={handleStop}
                    isLoading={isConnecting} 
                    placeholder="Ask a question about your research..." 
                    value={input}
                    onChange={setInput}
                    focusNonce={inputFocusNonce}
                    sessionId={currentSessionId}
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
