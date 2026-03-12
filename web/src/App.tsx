import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ChatMessage as ChatMessageComponent } from './components/chat/message';
import { ChatInput } from './components/chat/input';
import { ScrollToBottom } from './components/chat/scroll-to-bottom';
import { Bot, Sparkles, MessageSquare, Plus, Trash2, ChevronDown, PanelLeftClose, PanelLeftOpen, FileText, Code, Database, Brain } from 'lucide-react';
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
  todos?: any[];
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
  
  // Auto Mode State
  const [autoModeMap, setAutoModeMap] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('sessionAutoModeMap') || '{}');
    } catch {
      return {};
    }
  });
  const [pendingAutoMode, setPendingAutoMode] = useState(false);

  const handleAutoModeChange = (checked: boolean) => {
    if (currentSessionId) {
        setAutoModeMap(prev => {
            const next = { ...prev, [currentSessionId]: checked };
            localStorage.setItem('sessionAutoModeMap', JSON.stringify(next));
            return next;
        });
    } else {
        setPendingAutoMode(checked);
    }
  };

  const currentAutoMode = currentSessionId ? (autoModeMap[currentSessionId] || false) : pendingAutoMode;
  
  // Notification State
  const [unseenMemoriesCount, setUnseenMemoriesCount] = useState(0);
  const [unseenPapersCount, setUnseenPapersCount] = useState(0);
  const [unseenSessionIds, setUnseenSessionIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef(true);

  const [lastViewedMemoryId, setLastViewedMemoryId] = useState<string | null>(localStorage.getItem('lastViewedMemoryId'));
  const [lastViewedPaperId, setLastViewedPaperId] = useState<string | null>(localStorage.getItem('lastViewedPaperId'));

  // Use refs to keep linter happy for now as they might be used later
  useEffect(() => {
    if (lastViewedMemoryId) {}
    if (lastViewedPaperId) {}
  }, [lastViewedMemoryId, lastViewedPaperId]);

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

    const fetchMemories = () => {
        fetch('/api/memories?userId=web-user')
        .then(res => res.json())
        .then(data => {
            // Sort by created_at desc
            const sortedData = data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setMemories(sortedData);
            
            // Calculate unseen counts
            const papers = sortedData.filter((m: any) => m.type === 'paper');
            const otherMemories = sortedData.filter((m: any) => m.type !== 'paper');
            
            const lastViewedMemoryCount = parseInt(localStorage.getItem('lastViewedMemoryCount') || '0');
            const lastViewedPaperCount = parseInt(localStorage.getItem('lastViewedPaperCount') || '0');
            
            if (otherMemories.length > lastViewedMemoryCount) {
                setUnseenMemoriesCount(otherMemories.length - lastViewedMemoryCount);
            } else {
                setUnseenMemoriesCount(0);
            }
            
            if (papers.length > lastViewedPaperCount) {
                setUnseenPapersCount(papers.length - lastViewedPaperCount);
            } else {
                setUnseenPapersCount(0);
            }
        })
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

    fetchMemories();
    fetchSessions();
    
    // Poll for updates (Memories & Sessions) to update notification dots
    const pollInterval = setInterval(() => {
        fetchMemories();
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
  
  // Handler for clearing memory notifications
  const handleTabChange = (value: string) => {
      const now = new Date().toISOString();
      if (value === 'memory') {
          localStorage.setItem('lastViewedMemoryTimestamp', now);
          const memoriesList = memories.filter(m => m.type !== 'paper');
          const count = memoriesList.length;
          localStorage.setItem('lastViewedMemoryCount', count.toString());
          if (memoriesList.length > 0) {
              const latestId = memoriesList[0].id; // sorted desc
              localStorage.setItem('lastViewedMemoryId', latestId);
              setLastViewedMemoryId(latestId);
          }
          setUnseenMemoriesCount(0);
      } else if (value === 'papers') {
          localStorage.setItem('lastViewedPaperTimestamp', now);
          const papersList = memories.filter(m => m.type === 'paper');
          const count = papersList.length;
          localStorage.setItem('lastViewedPaperCount', count.toString());
          if (papersList.length > 0) {
              const latestId = papersList[0].id; // sorted desc
              localStorage.setItem('lastViewedPaperId', latestId);
              setLastViewedPaperId(latestId);
          }
          setUnseenPapersCount(0);
      }
  };



  // Auto-refresh chat history to catch async events (like memory updates)
  useEffect(() => {
    if (!currentSessionId) return; // Removed isConnecting check to allow polling while processing

    const interval = setInterval(() => {
        loadSession(currentSessionId);
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [currentSessionId, isConnecting]); // isConnecting is still a dep but ignored in logic

  const loadSession = async (sessionId: string) => {
      setCurrentSessionId(sessionId);
      try {
          const res = await fetch(`/api/sessions/${sessionId}/history`);
          const history = await res.json();
          
          // Reconstruct messages, merging logs into the *preceding* agent message or creating a placeholder
          const reconstructedMessages: ChatMessage[] = [];
          
          for (const msg of history) {
              // Check for auto research log to determine active state
              if (msg.role === 'log' && msg.content.includes('[AutoResearch]')) {
                  // If we see recent auto research logs, we can infer it *might* be active
                  // But history is past. We need to know if it is CURRENTLY active.
                  // The best way is to check the last message. If it's a log from AutoResearch
                  // and no final completion, it's active.
              }

              if (msg.role === 'log') {
                  // Find the last agent message to attach logs to
                  // Or if no agent message, create a pending one?
                  // Actually, logs usually come *before* or *during* the agent's reply.
                  // But in our current flow, agent message is created *after* reply? 
                  // No, agent message is added to DB at the end.
                  // Logs are added *during*.
                  // So in DB history: [User Msg, Log1, Log2, Agent Msg]
                  
                  // We want to display logs inside the Agent Message.
                  // So we need to buffer logs until we hit an agent message?
                  // Or attach them to the *next* agent message?
                  
                  // Wait, if we are loading history, we see: User -> Log -> Log -> Agent
                  // We should probably create a "Pending/Agent" message when we see the first log after a user message.
                  
                  let lastMsg = reconstructedMessages[reconstructedMessages.length - 1];
                  if (!lastMsg || lastMsg.role !== 'agent') {
                      // Create a new agent placeholder
                      const placeholder: ChatMessage = {
                          id: `temp-${msg.id}`, // Use log id as base
                          role: 'agent',
                          content: '',
                          logs: [msg.content],
                          timestamp: new Date(msg.timestamp)
                      };
                      reconstructedMessages.push(placeholder);
                  } else {
                      // Append to existing agent message
                      lastMsg.logs = [...(lastMsg.logs || []), msg.content];
                  }
              } else {
                  // Normal message
                  // If we have a "placeholder" agent message (content empty) and this is an agent message, merge them?
                  if (msg.role === 'assistant') {
                       let lastMsg = reconstructedMessages[reconstructedMessages.length - 1];
                       if (lastMsg && lastMsg.role === 'agent' && !lastMsg.content) {
                           // This was our placeholder. Update it.
                           lastMsg.id = msg.id;
                           lastMsg.content = msg.content;
                           lastMsg.timestamp = new Date(msg.timestamp); // Update timestamp to finish time
                           // logs are already there
                       } else {
                           reconstructedMessages.push({
                              id: msg.id,
                              role: 'agent',
                              content: msg.content,
                              timestamp: new Date(msg.timestamp),
                              logs: [],
                              attachments: msg.metadata?.attachments
                          });
                       }
                  } else {
                      reconstructedMessages.push({
                          id: msg.id,
                          role: msg.role === 'assistant' ? 'agent' : msg.role,
                          content: msg.content,
                          timestamp: new Date(msg.timestamp),
                          logs: [],
                          attachments: msg.metadata?.attachments
                      });
                  }
              }
          }
          
          setMessages(reconstructedMessages);

          // Check if the last message indicates an ongoing auto-research process
          // Heuristic: Last message is an agent message with logs containing [AutoResearch] 
          // AND the content does NOT say "Auto-research completed".
          const lastMsg = reconstructedMessages[reconstructedMessages.length - 1];
          if (lastMsg && lastMsg.role === 'agent') {
              const isAutoLog = lastMsg.logs?.some(l => l.includes('[AutoResearch]'));
              const isCompleted = lastMsg.content.includes('Auto-research completed');
              
              if (isAutoLog && !isCompleted && !lastMsg.content) {
                  // It's likely still running or was interrupted.
                  // Since we don't have persistent backend state for "running",
                  // we can't be 100% sure if the backend process is *still* alive just from DB history.
                  // BUT, if we are loading this session, we can assume the user wants to resume monitoring.
                  // If the backend process died, the SSE connection won't send updates, but the UI state is "connected".
                  
                  // However, `loadSession` is just fetching data. It doesn't reconnect SSE.
                  // We need to explicitly reconnect SSE if we think it's active.
                  
                  // If the session was created recently (e.g. < 5 mins ago) and incomplete, reconnect.
                  const lastUpdate = new Date(lastMsg.timestamp).getTime();
                  const now = Date.now();
                  if (now - lastUpdate < 5 * 60 * 1000) {
                      // Auto-reconnect
                      connectToSession(sessionId);
                  }
              }
          }
      } catch (err) {
          console.error('Failed to load session history:', err);
      }
  };

  const connectToSession = (sessionId: string) => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort(); // Close existing
      }
      
      setIsConnecting(true);
      
      const eventSource = new EventSource(`/api/sessions/${sessionId}/events`);
      
      abortControllerRef.current = {
          abort: () => {
              eventSource.close();
          }
      } as any;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // ... (reuse the logic from handleSend? Refactor needed)
        // For now, let's copy the logic or extract it.
        handleSSEMessage(data, sessionId);
      };
      
      eventSource.onerror = (err) => {
          console.error('Reconnection EventSource failed:', err);
          eventSource.close();
          setIsConnecting(false);
      };
  };

  const handleSSEMessage = (data: any, _sessionId: string) => {
        // Find the last agent message (placeholder or real)
        // If we reconnected, we might not have the exact "agentMsgId" in closure.
        // We need to find the *latest* agent message in state.
        
        if (data.type === 'token') {
          const content = data.content;
          if (content && content.startsWith('[TITLE_GENERATED]')) {
             // ...
          } else {
            setMessages(prev => {
                const lastIdx = prev.length - 1;
                const lastMsg = prev[lastIdx];
                if (lastMsg && lastMsg.role === 'agent') {
                    const newMsg = { ...lastMsg, content: lastMsg.content + content };
                    return [...prev.slice(0, lastIdx), newMsg];
                }
                return prev;
            });
          }
        } else if (data.type === 'log') {
             // ...
             setMessages(prev => {
                const lastIdx = prev.length - 1;
                const lastMsg = prev[lastIdx];
                if (lastMsg && lastMsg.role === 'agent') {
                    const rawContent = data.content;
                    let stats = undefined;
                    if (rawContent && typeof rawContent === 'string' && rawContent.includes('__STATS__')) {
                        const parts = rawContent.split('__STATS__');
                        try { stats = JSON.parse(parts[1]); } catch (e) {}
                    }
                    const newMsg = { ...lastMsg, logs: [...(lastMsg.logs || []), rawContent], stats: stats || lastMsg.stats };
                    return [...prev.slice(0, lastIdx), newMsg];
                }
                return prev;
            });
        }
        // ... (implement other types similarly for reconnection context)
        // For simplicity in this iteration, we just rely on `loadSession` polling for history updates 
        // if we are not "actively" generating new tokens but just waiting for logs.
        // But logs come via SSE.
        
        // Actually, the `handleSend` SSE logic is complex because it updates specific IDs.
        // When reconnecting, we don't have those IDs.
        // A better approach for "Resume" is:
        // 1. Load history (which gets logs).
        // 2. Poll history periodically (which gets new logs from DB).
        // 3. Only use SSE for *real-time* tokens if we are actively generating text.
        // The AutoResearch mode mostly generates *Logs* and *Files*, then a final text.
        // So polling `loadSession` might be enough for the "monitoring" phase!
        
        // Let's stick to the polling mechanism we already added:
        // useEffect(() => { ... loadSession ... }, 3000);
        // This naturally handles "reopening" the page.
        // We just need to make sure the "Stop" button appears if it looks active.
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

  const abortControllerRef = useRef<AbortController | null>(null);

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
      const eventSource = new EventSource(`/api/sessions/${currentSessionId!}/events`);
      
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
          // If log content contains __STATS__, parse it
          const rawContent = data.content;
          let stats = undefined;
          if (rawContent && typeof rawContent === 'string' && rawContent.includes('__STATS__')) {
              const parts = rawContent.split('__STATS__');
              try {
                  stats = JSON.parse(parts[1]);
              } catch (e) {}
          }

          setMessages(prev => prev.map(msg => 
            msg.id === agentMsgId 
              ? { ...msg, logs: [...(msg.logs || []), rawContent], stats: stats || msg.stats }
              : msg
          ));
        } else if (data.type === 'plan') {
          // data.content is { steps: [] }
          const plan = data.content;
          setMessages(prev => prev.map(msg => 
            msg.id === agentMsgId 
              ? { ...msg, todos: plan.steps }
              : msg
          ));
        } else if (data.type === 'todo') {
            // Update or add a single todo item
            const todoItem = data.content;
            setMessages(prev => prev.map(msg => {
                if (msg.id === agentMsgId) {
                    const existingTodos = msg.todos || [];
                    const index = existingTodos.findIndex((t: any) => t.id === todoItem.id);
                    if (index >= 0) {
                        // Update existing
                        const newTodos = [...existingTodos];
                        newTodos[index] = { ...newTodos[index], ...todoItem };
                        return { ...msg, todos: newTodos };
                    } else {
                        // Add new
                        return { ...msg, todos: [...existingTodos, todoItem] };
                    }
                }
                return msg;
            }));
        } else if (data.type === 'done') {
          eventSource.close();
          setIsConnecting(false); // Explicitly set connecting to false when done
          
          // Refresh sessions to get updated title/timestamp
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
          <Tabs defaultValue="chats" className="flex-1 flex flex-col min-h-0" onValueChange={handleTabChange}>
            <div className="px-4 pt-4 shrink-0">
              <TabsList className="w-full bg-zinc-100 p-1 mb-2 grid grid-cols-4 h-auto">
                  <TabsTrigger value="chats" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm relative" title="Chat">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Chat</span>
                    {unseenSessionIds.size > 0 && (
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="skills" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm" title="Skill">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Skill</span>
                  </TabsTrigger>
                  <TabsTrigger value="memory" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm relative" title="Mem">
                    <Brain className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Mem</span>
                    {unseenMemoriesCount > 0 && (
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="papers" className="px-1 py-1.5 flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm relative" title="Ref">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Ref</span>
                    {unseenPapersCount > 0 && (
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
                    )}
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
                          <div className="font-medium text-sm line-clamp-1 flex items-center gap-2">
                              {session.title || 'New Chat'}
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
                                        {Object.entries(groupedSkills).map(([packId, _]) => {
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
                                        <div className="font-medium text-zinc-900 leading-snug">
                                            {m.content}
                                            {/* Show New Tag if created_at is newer than last viewed session time OR simply if it's one of the new items */}
                                            {/* Logic: We have unseen count. The top N items are new. */}
                                            {/* But wait, filteredMemories might not be the raw list. */}
                                            {/* Better logic: Compare m.id with lastViewedMemoryId? No, IDs are random UUIDs. */}
                                            {/* Compare timestamps? We don't store timestamp of last view, only count/ID. */}
                                            {/* Let's assume the list is sorted by time desc. If we have N unseen, the first N are new. */}
                                            {/* BUT filters might hide some. */}
                                            {/* Robust logic: If m.created_at > lastViewedTimestamp? We need to store timestamp. */}
                                            
                                            {/* Let's use the ID method if we store the ID of the *top* item when we last viewed. */}
                                            {/* If we see an item that is newer than that ID? UUIDs don't have order. */}
                                            
                                            {/* Alternative: Store 'lastViewedTimestamp' in localStorage. */}
                                            {(() => {
                                                const lastViewedTime = localStorage.getItem('lastViewedMemoryTimestamp');
                                                const isNew = !lastViewedTime || new Date(m.created_at) > new Date(lastViewedTime);
                                                if (isNew) {
                                                    return (
                                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-800">
                                                            NEW
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
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
                           <div className="font-medium text-zinc-900 line-clamp-2 leading-snug">
                               {m.metadata?.title || m.content.replace('Paper: ', '')}
                               {(() => {
                                   const lastViewedTime = localStorage.getItem('lastViewedPaperTimestamp');
                                   const isNew = !lastViewedTime || new Date(m.created_at) > new Date(lastViewedTime);
                                   if (isNew) {
                                       return (
                                           <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-800">
                                               NEW
                                           </span>
                                       );
                                   }
                                   return null;
                               })()}
                           </div>
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
                    isThinking={msg.role === 'agent' && !msg.content && index === messages.length - 1}
                    logs={msg.logs}
                    todos={msg.todos}
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
                    autoMode={currentAutoMode}
                    onAutoModeChange={handleAutoModeChange}
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
