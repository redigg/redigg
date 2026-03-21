import { User, Sparkles, Copy, RefreshCw, Paperclip, FileText, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useMemo, memo, useEffect } from "react";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ui/code-block";
import { type BundledLanguage } from "shiki";
import { InlineCitation, InlineCitationCard, InlineCitationCardTrigger, InlineCitationCardBody, InlineCitationCarousel, InlineCitationCarouselHeader, InlineCitationCarouselPrev, InlineCitationCarouselNext, InlineCitationCarouselIndex, InlineCitationCarouselContent, InlineCitationCarouselItem, InlineCitationSource } from "@/components/ai-elements/inline-citation";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai/reasoning";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";

interface Action {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  output?: any;
  status: 'running' | 'success' | 'error';
}

interface ChatMessageProps {
  role: "user" | "agent";
  content: string;
  thinking?: string;
  actions?: Action[];
  attachments?: any[];
  isThinking?: boolean;
  stats?: {
    duration?: number;
    tokens?: number;
  };
  onCopy?: (content: string) => void;
  onRegenerate?: () => void;
}

const MarkdownContent = memo(({ content }: { content: string }) => {
  const processedContent = useMemo(() => content.replace(/^\[AUTO\]\s*/, ''), [content]);
  
  return (
    <div className="prose prose-zinc prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-50 prose-pre:border prose-pre:border-zinc-200 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:text-zinc-800 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({children}: any) => {
            const codeElement = children as any;
            const codeProps = codeElement?.props || {};
            const rawCode = String(codeProps.children || "").replace(/\n$/, '');
            const match = /language-(\w+)/.exec(codeProps.className || '');
            const language = (match ? match[1] : 'text') as BundledLanguage;
            return (
              <div className="my-4 not-prose">
                <CodeBlock code={rawCode} language={language}>
                  <CodeBlockCopyButton />
                </CodeBlock>
              </div>
            )
          },
          code: ({className, children, ...props}: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !String(children).includes('\n');
            if (isInline) {
              return (
                <code className="text-zinc-800 text-sm font-mono font-bold px-1 rounded bg-zinc-100 box-decoration-clone" {...props}>
                  {children}
                </code>
              );
            }
            return <code className={className} {...props}>{children}</code>
          },
          ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 my-4 space-y-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 my-4 space-y-1" {...props} />,
          li: ({node, ...props}) => <li className="pl-1" {...props} />,
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-5 mb-3" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-4 mb-2" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-zinc-300 pl-4 italic text-zinc-600 my-4" {...props} />,
          a: ({node, ...props}) => {
            const href = props.href || '';
            const lowerHref = href.toLowerCase();
            const isPdf = lowerHref.endsWith('.pdf');
            const isMarkdown = lowerHref.endsWith('.md');
            const isFile = lowerHref.endsWith('.txt') || lowerHref.endsWith('.json') || lowerHref.endsWith('.csv') || lowerHref.endsWith('.zip');
            
            const handleFileClick = (e: React.MouseEvent) => {
              e.preventDefault();
              // Handle both /files/ prefix and direct file paths
              let filePath = href;
              if (href.startsWith('/files/')) {
                filePath = href.replace('/files/', '');
              }
              fetch(`/api/open?path=${encodeURIComponent(filePath)}`);
            };
            
            if (isPdf) {
              return (
                <a 
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors no-underline font-medium text-xs align-middle cursor-pointer"
                  onClick={handleFileClick}
                >
                  <FileText className="h-3 w-3" />
                  {props.children}
                </a>
              );
            }
            
            if (isMarkdown) {
              return (
                <a 
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 transition-colors no-underline font-medium text-xs align-middle cursor-pointer"
                  onClick={handleFileClick}
                >
                  <FileText className="h-3 w-3" />
                  {props.children}
                </a>
              );
            }
            
            if (isFile) {
              return (
                <a 
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 transition-colors no-underline font-medium text-xs align-middle cursor-pointer"
                  onClick={handleFileClick}
                >
                  <FileText className="h-3 w-3" />
                  {props.children}
                </a>
              );
            }
            
            // Regular URLs - open directly in new tab
            if (href.startsWith('http://') || href.startsWith('https://')) {
              return (
                <a 
                  className="text-indigo-600 hover:underline cursor-pointer inline-flex items-center gap-0.5"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {props.children}
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </a>
              );
            }
            
            return (
              <InlineCitation>
                <InlineCitationCard>
                  <InlineCitationCardTrigger sources={[href]}>
                    <span className="text-indigo-600 hover:underline cursor-pointer">{props.children}</span>
                  </InlineCitationCardTrigger>
                  <InlineCitationCardBody>
                    <InlineCitationCarousel>
                      <InlineCitationCarouselHeader>
                        <InlineCitationCarouselPrev />
                        <InlineCitationCarouselNext />
                        <InlineCitationCarouselIndex />
                      </InlineCitationCarouselHeader>
                      <InlineCitationCarouselContent>
                        <InlineCitationCarouselItem>
                          <InlineCitationSource title={String(props.children)} url={href} />
                        </InlineCitationCarouselItem>
                      </InlineCitationCarouselContent>
                    </InlineCitationCarousel>
                  </InlineCitationCardBody>
                </InlineCitationCard>
              </InlineCitation>
            );
          },
          table: ({node, ...props}) => <div className="overflow-x-auto my-4 w-full block max-w-full"><table className="min-w-full divide-y divide-zinc-200 border border-zinc-200 rounded-lg" {...props} /></div>,
          th: ({node, ...props}) => <th className="px-3 py-2 bg-zinc-50 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap" {...props} />,
          td: ({node, ...props}) => <td className="px-3 py-2 align-top text-sm text-zinc-500 border-t border-zinc-100 min-w-[100px]" {...props} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

export const ChatMessage = memo(function ChatMessage({ role, content, thinking, actions, attachments, isThinking, stats, onCopy, onRegenerate }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState(false);
  
  const hasThinking = thinking && thinking.trim().length > 0;
  const hasActions = actions && actions.length > 0;
  const showReasoning = isThinking || hasThinking;

  // Debug: log when thinking changes
  useEffect(() => {
    console.log('[ChatMessage] thinking:', thinking?.substring(0, 50), 'hasThinking:', hasThinking, 'isThinking:', isThinking, 'showReasoning:', showReasoning);
  }, [thinking, hasThinking, isThinking, showReasoning]);

  const handleCopy = () => {
    if (onCopy) {
      onCopy(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const extractUrls = (output: any): string[] => {
    if (!output) return [];
    const urls: string[] = [];
    
    if (output.papers && Array.isArray(output.papers)) {
      for (const paper of output.papers) {
        if (paper.url) urls.push(paper.url);
        else if (paper.pdfUrl) urls.push(paper.pdfUrl);
      }
    }
    if (output.sample && Array.isArray(output.sample)) {
      for (const item of output.sample) {
        if (typeof item === 'string' && item.startsWith('http')) urls.push(item);
        else if (typeof item === 'object' && item?.url) urls.push(item.url);
      }
    }
    
    return [...new Set(urls)].slice(0, 5);
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
                {content.replace(/\[(AUTO RESEARCH|WEB SEARCH) REQUEST\]/, '').trim()}
              </div>
            </div>
          ) : (
            <>
              {/* Thinking Section */}
              {showReasoning && (
                <Reasoning className="mb-3" isStreaming={isThinking} hasContent={!!hasThinking}>
                  <ReasoningTrigger />
                  <ReasoningContent>{thinking || ''}</ReasoningContent>
                </Reasoning>
              )}

              {/* Actions Section */}
              {hasActions && (
                <div className="mb-3 space-y-2">
                  {actions.map((action) => {
                    const urls = extractUrls(action.output);
                    const state = action.status === 'running' ? 'input-available' 
                      : action.status === 'success' ? 'output-available' 
                      : 'output-error';
                    
                    return (
                      <Tool key={action.id} defaultOpen={action.status !== 'success'}>
                        <ToolHeader 
                          type={`tool-${action.name}`}
                          state={state}
                          title={action.name}
                        />
                        <ToolContent>
                          {action.input && <ToolInput input={action.input} />}
                          <ToolOutput 
                            output={action.output}
                            errorText={action.status === 'error' ? String(action.output) : undefined}
                          />
                          {urls.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {urls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] no-underline"
                                >
                                  <ExternalLink className="h-2.5 w-2.5" />
                                  {new URL(url).hostname}
                                </a>
                              ))}
                            </div>
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  })}
                </div>
              )}

              {/* Main Content */}
              <div className="text-left w-full">
                <MarkdownContent content={content} />
                {!content && isThinking && (
                  <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse align-middle ml-1"></span>
                )}
              </div>

              {/* Attachments */}
              {attachments && attachments.length > 0 && (
                <div className="mt-6 border-t border-zinc-100 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, i) => (
                      <a 
                        key={i} 
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-white px-3 py-2.5 rounded-lg text-sm border border-zinc-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group no-underline"
                      >
                        <div className="h-8 w-8 bg-red-50 rounded-md flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform border border-red-100">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-[120px]">
                          <span className="text-zinc-800 font-medium truncate max-w-[200px]">{file.name}</span>
                          <span className="text-[10px] text-zinc-400">Generated File</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
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
            
            {attachments && attachments.length > 0 && (
              <div className="flex items-center gap-1.5 ml-1 px-2 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium border border-red-100/50">
                <FileText className="h-3 w-3" />
                <span>{attachments.length} file{attachments.length > 1 ? 's' : ''} generated</span>
              </div>
            )}
            
            <div className="flex-1" />
            <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
              {typeof stats?.duration === 'number' && (
                <span>{(stats.duration / 1000).toFixed(2)}s</span>
              )}
              {typeof stats?.duration === 'number' && <span className="w-0.5 h-2.5 bg-zinc-300"></span>}
              <span className="flex items-center gap-1">
                {Math.ceil(content.length / 4)} tokens
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
