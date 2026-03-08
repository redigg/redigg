import { Send, Paperclip, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSubmit: (value: string, attachments?: any[], webSearch?: boolean) => void;
  isLoading?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function ChatInput({ onSubmit, isLoading, placeholder = "Ask Redigg...", value, onChange }: ChatInputProps) {
  const [internalInput, setInternalInput] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isControlled = value !== undefined;
  const input = isControlled ? value : internalInput;
  
  const setInput = (newValue: string) => {
    if (isControlled) {
      onChange?.(newValue);
    } else {
      setInternalInput(newValue);
    }
  };

  const handleSubmit = () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    onSubmit(input, attachments, false);
    setInput("");
    setAttachments([]);
    // Don't reset web search preference? Or should we? Let's keep it per message for now or persistent.
    // Usually persistent per session is better, but here simple toggle.
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      // Auto-resize
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const formData = new FormData();
          formData.append('file', file);

          try {
              const res = await fetch('/api/upload', {
                  method: 'POST',
                  body: formData
              });
              if (res.ok) {
                  const data = await res.json();
                  setAttachments(prev => [...prev, data]);
              }
          } catch (err) {
              console.error('Upload failed', err);
          }
          
          // Reset input
          e.target.value = '';
      }
  };

  return (
    <div className="relative flex flex-col w-full max-w-3xl mx-auto bg-white border border-zinc-200 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all overflow-hidden">
        {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 pb-0">
                {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-zinc-100 px-3 py-1.5 rounded-md text-xs border border-zinc-200">
                        <Paperclip className="h-3 w-3 text-zinc-500" />
                        <span className="text-zinc-700 max-w-[150px] truncate">{file.name}</span>
                        <button 
                            onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-zinc-400 hover:text-red-500 ml-1"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}
            </div>
        )}
        
        <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[60px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 p-4 text-base scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent shadow-none"
            disabled={isLoading}
        />
        
        <div className="flex items-center justify-between p-2 pl-4 border-t border-zinc-50 bg-zinc-50/50">
            <div className="flex items-center gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect}
                />
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-zinc-400 hover:text-zinc-600"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                >
                    <Paperclip className="h-4 w-4" />
                </Button>
            </div>
            
            <Button 
                onClick={handleSubmit} 
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                size="icon"
                className={cn(
                    "h-8 w-8 transition-all duration-200",
                    input.trim() || attachments.length > 0 ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" : "bg-zinc-200 text-zinc-400"
                )}
            >
                <Send className="h-4 w-4" />
            </Button>
        </div>
    </div>
  );
}
