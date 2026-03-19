import type { AssistantTranscriptMessage, JSONMessage, UserTranscriptMessage } from '@humeai/voice-react';
import { useMemo } from 'react';

interface EviConvoPanelProps {
    messages: (JSONMessage | UserTranscriptMessage | AssistantTranscriptMessage | { type: string; message?: { content?: string }; transcript?: string; text?: string; models?: { prosody?: { scores?: Record<string, number> | { name: string; score: number }[] } } })[];
    imageUrl: string;
}

export default function EviConvoPanel({ messages, imageUrl }: EviConvoPanelProps) {
    // Find last user and assistant messages for captions
    const lastUserMessage = useMemo(() => {
        return messages.slice().reverse().find(m => m.type === 'user_message') as UserTranscriptMessage | undefined;
    }, [messages]);

    const lastAssistantMessage = useMemo(() => {
        return messages.slice().reverse().find(m => m.type === 'assistant_message') as AssistantTranscriptMessage | undefined;
    }, [messages]);

    const topEmotions = useMemo(() => {
        if (!lastUserMessage || !lastUserMessage.models?.prosody?.scores) return [];
        const scores = lastUserMessage.models.prosody.scores;
        
        let sorted: {name: string, score: number}[] = [];
        if (Array.isArray(scores)) {
             sorted = [...(scores as {name: string, score: number}[])].sort((a: {score: number}, b: {score: number}) => b.score - a.score);
        } else {
             sorted = Object.entries(scores)
                .map(([name, score]) => ({ name, score: Number(score) }))
                .sort((a, b) => b.score - a.score);
        }
        return sorted.slice(0, 3);
    }, [lastUserMessage]);

    // Handle extraction safely depending on exactly how Hume sends transcript payloads
    const extractText = (message: UserTranscriptMessage | AssistantTranscriptMessage | undefined) => {
        if (!message) return '...';
        if ('message' in message && message.message?.content) return message.message.content;
        
        const msg = message as unknown as Record<string, unknown>;
        if (typeof msg.transcript === 'string') return msg.transcript;
        if (typeof msg.text === 'string') return msg.text;
        
        return '...';
    };

    return (
        <div className="relative w-full h-full flex flex-col justify-end">
            
            {/* Absolute Background Image */}
            <img 
                src={imageUrl} 
                alt="Scenario Environment" 
                className="absolute inset-0 w-full h-full object-cover opacity-80" 
            />

            {/* Emotion Overlay (Top Left) */}
            {topEmotions.length > 0 && (
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    {topEmotions.map(emotion => (
                        <div key={emotion.name} className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10 flex items-center justify-between gap-3 min-w-[120px] shadow-lg">
                            <span>{emotion.name}</span>
                            <span className="text-green-400">{(emotion.score * 100).toFixed(0)}%</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Fallback Camera Label if no active emotions yet */}
            {topEmotions.length === 0 && (
                <div className="absolute top-4 right-4 font-bold text-white/50 text-xs bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
                    Scenario Camera Active
                </div>
            )}

            {/* Captions Overlay (Bottom) */}
            <div className="relative z-10 w-full p-6 pt-16 bg-linear-to-t from-black via-black/80 to-transparent flex flex-col justify-end min-h-[180px]">
                <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full">
                    {lastUserMessage && (
                        <div className="text-sm text-neutral-300 drop-shadow-md">
                            <span className="font-bold text-blue-400 mr-2 drop-shadow-sm">You:</span>
                            {extractText(lastUserMessage)}
                        </div>
                    )}
                    {lastAssistantMessage && (
                        <div className="text-lg text-white drop-shadow-lg font-medium">
                            <span className="font-bold text-purple-400 mr-2 drop-shadow-sm">Voice:</span>
                            {extractText(lastAssistantMessage)}
                        </div>
                    )}
                    {(!lastUserMessage && !lastAssistantMessage) && (
                        <div className="text-sm text-neutral-400/80 italic mt-auto">
                            Awaiting conversation...
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
}
