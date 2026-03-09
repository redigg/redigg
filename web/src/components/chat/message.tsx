import { Bot, User, Sparkles, Copy, RefreshCw, Paperclip, FileText, Code, Search, Circle, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ui/code-block";
import { type BundledLanguage } from "shiki";

interface ChatMessageProps {
  role: "user" | "agent";
  content: string;
  isThinking?: boolean;
  logs?: string[];
  stats?: {
    duration: number;
  };
  attachments?: any[];
  onCopy?: (content: string) => void;
  onRegenerate?: () => void;
}

// Helper to parse log content and return structured activity
const parseActivity = (log: string) => {
    // Standardized log prefixes from ResearchAgent
    // Hide evolution logs if they are just raw memory content to avoid clutter
    // Actually, we want to hide logs that are just "Evolution: New Memory: ..." to avoid spam, 
    // but show "Extracted X new memories"
    if (log.includes('[Evolution]')) {
        if (log.includes('New Memory:') || log.includes('Updated Memory:')) {
            return { icon: Brain, label: 'Evolution', color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100', hidden: true };
        }
        return { icon: Brain, label: 'Evolution', color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' };
    }
    
    if (log.includes('[Search]') || log.includes('LiteratureReview')) return { icon: Search, label: 'Researching', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' };
    if (log.includes('[PaperAnalysis]') || log.includes('Reading content')) return { icon: FileText, label: 'Reading Paper', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' };
    if (log.includes('[CodeAnalysis]') || log.includes('Analyzing codebase')) return { icon: Code, label: 'Analyzing Code', color: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-100' };
    if (log.includes('[PdfGenerator]') || log.includes('Generating PDF')) return { icon: FileText, label: 'Generating PDF', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' };
    if (log.includes('[Agent]') || log.includes('Plan created')) return { icon: Sparkles, label: 'Planning', color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' };
    if (log.includes('[Error]')) return { icon: Circle, label: 'Error', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
    if (log.includes('[Warning]')) return { icon: Circle, label: 'Warning', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' };
    
    // Default
    return { icon: Circle, label: 'Processing', color: 'text-zinc-400', bg: 'bg-zinc-50', border: 'border-zinc-100' };
};

export function ChatMessage({ role, content, isThinking, logs, stats, attachments, onCopy, onRegenerate }: ChatMessageProps) {
    // State for copy feedback
    const [isCopied, setIsCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleCopy = () => {
        if (onCopy) {
            onCopy(content);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 px-4 py-4 w-full max-w-3xl mx-auto",
        role === "user" ? "flex-row-reverse" : ""
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow-sm",
          role === "user"
            ? "bg-zinc-900 text-zinc-50 border-zinc-900"
            : "bg-white text-zinc-900 border-zinc-200"
        )}
      >
        {role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-indigo-500" />}
      </div>

      <div className={cn("flex-1 space-y-2 min-w-0", role === "user" ? "text-right" : "")}>
        <div className="prose prose-zinc prose-p:leading-relaxed prose-pre:p-0 break-words dark:prose-invert max-w-none">
          {role === "user" ? (
            <div className="flex flex-col items-end gap-2 max-w-full">
                {attachments && attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end mb-1">
                        {attachments.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg text-xs border border-zinc-200 shadow-sm">
                                <Paperclip className="h-3.5 w-3.5 text-zinc-500" />
                                <span className="text-zinc-700 font-medium max-w-[150px] truncate">{file.name}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="bg-zinc-100 text-zinc-900 rounded-2xl rounded-tr-sm px-4 py-2 inline-block text-left max-w-full">
                    {content}
                </div>
            </div>
          ) : (
            <>
                {logs && logs.length > 0 && (
                    <div className="mb-4">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors bg-zinc-50 px-2 py-1 rounded-md border border-zinc-200/50"
                        >
                            {isThinking ? (
                                <span className="flex h-1.5 w-1.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                                </span>
                            ) : (
                                <Bot className="h-3 w-3" />
                            )}
                            {isThinking ? "Thinking..." : "Thought Process"}
                        </button>
                        
                        {(isExpanded || isThinking) && (
                            <div className="mt-3 space-y-2">
                                {logs.map((log, i) => {
                                    // Parse stats if available
                                    let displayLog = log;
                                    let logStats = null;
                                    if (log.includes('__STATS__')) {
                                        const parts = log.split('__STATS__');
                                        displayLog = parts[0];
                                        try {
                                            logStats = JSON.parse(parts[1]);
                                        } catch (e) {}
                                    }
                                    
                                    const activity = parseActivity(displayLog);
                                    if (activity.hidden) return null;
                                    const ActivityIcon = activity.icon;

                                    return (
                                        <div key={i} className="group flex items-start gap-3 text-xs relative pl-2 pb-2 last:pb-0">
                                            {/* Connector Line */}
                                            {i !== logs.length - 1 && (
                                                <div className="absolute left-[15px] top-6 bottom-0 w-px bg-zinc-100 group-last:hidden"></div>
                                            )}
                                            
                                            <div className={cn(
                                                "shrink-0 h-6 w-6 rounded-full flex items-center justify-center border shadow-sm z-10",
                                                activity.bg, activity.border
                                            )}>
                                                <ActivityIcon className={cn("h-3 w-3", activity.color)} />
                                            </div>
                                            
                                            <div className="flex-1 pt-0.5 min-w-0">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="font-medium text-zinc-700">{activity.label}</span>
                                                    {logStats && (
                                                        <span className="text-[10px] text-zinc-400 font-mono">
                                                            {(logStats.duration / 1000).toFixed(2)}s
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-zinc-500 mt-0.5 leading-relaxed break-words">
                                                    {displayLog.replace(/\[.*?\]/g, '').trim()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="text-left w-full">
                    <div className="prose prose-zinc prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-50 prose-pre:border prose-pre:border-zinc-200 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:text-zinc-800 prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            pre: ({children}: any) => {
                                // The children of 'pre' is usually a 'code' element in standard markdown
                                const codeElement = children as any;
                                const codeProps = codeElement?.props || {};
                                const rawCode = String(codeProps.children || "").replace(/\n$/, '');
                                
                                const match = /language-(\w+)/.exec(codeProps.className || '');
                                const language = (match ? match[1] : 'text') as BundledLanguage;

                                return (
                                    <div className="my-4 not-prose">
                                        <CodeBlock 
                                            code={rawCode} 
                                            language={language}
                                        >
                                            <CodeBlockCopyButton />
                                        </CodeBlock>
                                    </div>
                                )
                            },
                            code: ({className, children, ...props}: any) => {
                                // If this code element is inside a pre, we don't want to render it again
                                // because the 'pre' handler above already took care of the content.
                                // ReactMarkdown renders <pre><code>...</code></pre>
                                // We are replacing the <pre> with our CodeBlock, which renders its own code.
                                // However, ReactMarkdown might still try to render the inner <code> if we don't handle it.
                                // But since we intercept 'pre' and don't render {children}, this 'code' handler 
                                // will only be called for INLINE code (not inside pre).
                                
                                const match = /language-(\w+)/.exec(className || '')
                                const isInline = !match && !String(children).includes('\n');
                                
                                if (isInline) {
                                    return (
                                        <code className="text-zinc-800 text-sm font-mono font-bold px-1 rounded bg-zinc-100 box-decoration-clone" {...props}>
                                            {children}
                                        </code>
                                    );
                                }
                                
                                // If it's not inline but somehow we got here (should be caught by pre), 
                                // treat as inline to avoid double boxing or just return as is.
                                return (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                )
                            },
                            ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 my-4 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 my-4 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-5 mb-3" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-4 mb-2" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-zinc-300 pl-4 italic text-zinc-600 my-4" {...props} />,
                            a: ({node, ...props}) => <a className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                            table: ({node, ...props}) => <div className="overflow-x-auto my-4 w-full block max-w-full"><table className="min-w-full divide-y divide-zinc-200 border border-zinc-200 rounded-lg" {...props} /></div>,
                            th: ({node, ...props}) => <th className="px-3 py-2 bg-zinc-50 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap" {...props} />,
                            td: ({node, ...props}) => <td className="px-3 py-2 align-top text-sm text-zinc-500 border-t border-zinc-100 min-w-[100px]" {...props} />,
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                    </div>
                    {!content && isThinking && (
                        <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse align-middle ml-1"></span>
                    )}
                </div>
            </>
          )}
        </div>
        
                {role === "agent" && !isThinking && content && (
            <div className="flex items-center gap-2 pt-2 relative z-10">
                <div className="relative">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-zinc-400 hover:text-zinc-900"
                        onClick={handleCopy}
                    >
                        {isCopied ? <span className="text-xs font-bold text-green-600">✓</span> : <Copy className="h-3 w-3" />}
                    </Button>
                    {isCopied && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap animate-in fade-in zoom-in-95 duration-200 z-50 pointer-events-none">
                            Copied!
                        </span>
                    )}
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-zinc-400 hover:text-zinc-900"
                    onClick={onRegenerate}
                >
                    <RefreshCw className="h-3 w-3" />
                </Button>
                <div className="flex-1" />
                <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                    {stats?.duration && (
                        <span>{(stats.duration / 1000).toFixed(2)}s</span>
                    )}
                    {stats?.duration && <span className="w-0.5 h-2.5 bg-zinc-300"></span>}
                    <span className="flex items-center gap-1">
                        {Math.ceil(content.length / 4)} tokens
                    </span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
