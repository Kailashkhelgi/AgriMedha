import React, { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are AgriMedha AI, an expert agricultural assistant for Indian farmers. 
You help with:
- Crop selection based on soil type, pH, NPK values, season, and location
- Fertilizer recommendations and application schedules
- Pest and disease identification and treatment
- Irrigation advice and water management
- Weather impact on farming decisions
- Market price trends and selling strategies
- Organic farming practices
- Government schemes and MSP information
- Soil health improvement techniques

Always give practical, actionable advice. Keep responses concise and farmer-friendly.
Support queries in English, Hindi, Kannada, Punjabi, Telugu, and Marathi.
When answering, use simple language that a farmer can understand.`;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const QUICK_QUESTIONS = [
  'Best crops for black soil?',
  'Yellow leaves on tomato?',
  'Urea dose for wheat?',
  'How to improve soil health?',
];

const LANG_SPEECH_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  pa: 'pa-IN',
  te: 'te-IN',
  mr: 'mr-IN'
};

export default function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Namaste! 🌾 I\'m AgriMedha AI. Ask me anything about crops, soil, fertilizers, pests, or farming practices. I support Hindi, Kannada, Punjabi, Telugu, and Marathi too!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please try Google Chrome.');
      return;
    }

    const appLang = localStorage.getItem('lang') ?? 'en';
    const speechLang = LANG_SPEECH_MAP[appLang] ?? 'en-IN';

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = speechLang;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (text) {
        setInput(text);
      }
    };

    recognition.onerror = (err: any) => {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function speakText(text: string, index: number) {
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (speakingMsgIndex === index) {
          setSpeakingMsgIndex(null);
          return;
        }
      }

      // Clean text from markdown formatting
      const cleanText = text
        .replace(/[*_#`~\-+]/g, '')
        .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const appLang = localStorage.getItem('lang') ?? 'en';
      utterance.lang = LANG_SPEECH_MAP[appLang] ?? 'en-IN';

      utterance.onstart = () => setSpeakingMsgIndex(index);
      utterance.onend = () => setSpeakingMsgIndex(null);
      utterance.onerror = () => setSpeakingMsgIndex(null);

      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in this browser.');
    }
  }

  async function sendMessage(text?: string) {
    const userText = text ?? input.trim();
    if (!userText || loading) return;
    setInput('');

    // Stop speaking if new message is sent
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIndex(null);
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);

    if (!apiKey || apiKey === 'your_gemini_api_key') {
      setMessages([...newMessages, {
        role: 'assistant',
        content: '⚠️ Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.\n\nGet a free key at: https://aistudio.google.com/app/apikey'
      }]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: SYSTEM_PROMPT }]
            },
            ...newMessages.slice(1).map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }]
            })),
            { role: 'user', parts: [{ text: userText }] }
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        })
      });

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
        ?? 'Sorry, I could not get a response. Please try again.';

      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Network error. Please check your connection and try again.'
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* Floating Button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1b5e20, #2e7d32)',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', transition: 'transform 0.2s',
        }}
        title="AgriMedha AI Assistant"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat Window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 999,
          width: 380, height: 550, background: '#fff',
          borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid #e0e0e0',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1b5e20, #2e7d32)',
            padding: '14px 16px', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: '1.4rem' }}>🌿</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>AgriMedha AI</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Powered by Gemini 1.5 Flash</div>
            </div>
            <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#69f0ae' }} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? '#1b5e20' : '#f1f8e9',
                  color: msg.role === 'user' ? '#fff' : '#1a1a1a',
                  fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => speakText(msg.content, i)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.75rem', color: '#2e7d32', marginTop: 4, padding: '2px 4px',
                      display: 'inline-flex', alignItems: 'center', gap: 4
                    }}
                  >
                    {speakingMsgIndex === i ? '🔊 Speaking...' : '🔊 Read Aloud'}
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f1f8e9', borderRadius: '12px 12px 12px 2px', padding: '8px 14px', fontSize: '1.2rem' }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>⏳</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_QUESTIONS.map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  style={{
                    background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 20,
                    padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', color: '#1b5e20',
                  }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={toggleListening}
              style={{
                background: isListening ? '#e53935' : '#e8f5e9',
                color: isListening ? '#fff' : '#2e7d32',
                border: 'none', borderRadius: '50%',
                width: 36, height: 36, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
                boxShadow: isListening ? '0 0 10px rgba(229,57,53,0.5)' : 'none',
                transition: 'all 0.2s',
                animation: isListening ? 'pulse 1.5s infinite' : 'none'
              }}
              title={isListening ? 'Stop Listening' : 'Speak to Assistant'}
            >
              {isListening ? '🛑' : '🎤'}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={isListening ? "Listening..." : "Ask about crops, soil, pests…"}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 20, border: '1px solid #ddd',
                fontSize: '0.85rem', outline: 'none',
                backgroundColor: isListening ? '#ffebee' : '#fff'
              }}
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
              style={{
                background: '#1b5e20', color: '#fff', border: 'none', borderRadius: '50%',
                width: 36, height: 36, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
