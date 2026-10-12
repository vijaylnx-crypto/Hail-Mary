import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.static(__dirname));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// HTTP Text Health Chat API endpoint (Fallback & direct Q&A)
app.post('/api/gemini/health-chat', async (req, res) => {
  try {
    const { message, healthContext, history } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemInstruction = `You are Orbit Health AI, a knowledgeable, encouraging health and fitness advisor built into Orbit Health Tracker.
User Health Profile & Current Log:
${healthContext || 'No specific logs today.'}

Instructions:
- Provide clear, empathetic, scientifically grounded health, nutrition, activity, and recovery guidance.
- Tailor advice to the user's logged calories in/out, protein intake, sleep, and weight when relevant.
- Keep answers concise, actionable, and conversational (around 2-4 paragraphs max).
- If symptoms or medical emergencies are described, recommend consulting a healthcare professional.`;

    // Construct conversation contents
    const contents = [];
    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.role && item.text) {
          contents.push({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.text }],
          });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text || 'I am ready to help you with your health goals.' });
  } catch (err) {
    console.error('Health chat error:', err);
    let msg = err.message || 'Failed to generate response from Gemini AI';
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch (_) {}
    res.status(500).json({
      error: msg,
    });
  }
});

// WebSocket for Gemini Live API real-time voice conversation (gemini-3.8-live)
const wss = new WebSocketServer({ server, path: '/api/live' });

wss.on('connection', async (clientWs) => {
  console.log('[WebSocket] Client connected for Gemini Live session');
  let liveSession = null;
  let isSessionReady = false;

  const initLiveSession = async (userHealthContext = '') => {
    try {
      const systemInstruction = `You are Orbit Health AI, a real-time voice companion inside Orbit Health Tracker.
You are talking to the user via real-time speech. Speak naturally, warmly, concisely, and encouragingly.
User's Current Health Metrics & Mission Data:
${userHealthContext || 'User is checking in.'}

Guidelines:
- Keep voice answers brief and conversational (1 to 3 sentences typical for spoken dialog).
- Proactively reference their daily calories, protein, workouts, or sleep when relevant.
- Be positive and motivating.`;

      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' }, // Natural warm voice
            },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message) => {
            if (clientWs.readyState !== clientWs.OPEN) return;

            // Audio output from model (raw 24kHz PCM)
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: 'audio', audio }));
            }

            // Real-time transcription of model speech
            const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (text) {
              clientWs.send(JSON.stringify({ type: 'text', text }));
            }
            if (message.serverContent?.outputAudioTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'text',
                  text: message.serverContent.outputAudioTranscription.text,
                })
              );
            }

            // User input speech transcription from model
            if (message.serverContent?.inputAudioTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'userTranscript',
                  text: message.serverContent.inputAudioTranscription.text,
                })
              );
            }

            // Turn complete or interrupted
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turnComplete' }));
            }
          },
          onerror: (err) => {
            console.error('[Gemini Live Error]', err);
            let msg = err.message || 'Gemini Live error';
            try {
              const parsed = JSON.parse(msg);
              if (parsed?.error?.message) msg = parsed.error.message;
            } catch (_) {}
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: msg,
                })
              );
            }
          },
          onclose: () => {
            console.log('[Gemini Live] Session closed');
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ type: 'closed' }));
            }
          },
        },
      });

      isSessionReady = true;
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ type: 'ready' }));
      }
    } catch (err) {
      console.error('[Gemini Live Init Failed]', err);
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            message: err.message || 'Failed to establish Gemini Live connection',
          })
        );
      }
    }
  };

  clientWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'init') {
        await initLiveSession(msg.healthContext);
        return;
      }

      if (!isSessionReady || !liveSession) {
        // If not initialized yet, initialize with default
        await initLiveSession();
      }

      if (msg.audio) {
        liveSession.sendRealtimeInput({
          audio: {
            data: msg.audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (msg.text) {
        liveSession.sendRealtimeInput({
          text: msg.text,
        });
      }
    } catch (err) {
      console.error('[WebSocket Error processing message]', err);
    }
  });

  clientWs.on('close', () => {
    if (liveSession) {
      try {
        liveSession.close();
      } catch (_) {}
      liveSession = null;
    }
  });

  clientWs.on('error', (err) => {
    console.error('[Client WebSocket Error]', err);
  });
});

// Single-page fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
