
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AudioWaveform,
  ArrowLeft,
  Upload,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  FileAudio,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Activity,
} from "lucide-react";
import "./App.css";

const API_BASE = "http://localhost:8081";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function AudioDetection() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [audioUrl]);

  function clearAudio() {
    if (recording && mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setAudioFile(null);
    setAudioUrl("");
    setStatus("");
    setError("");
    setPlaying(false);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function acceptAudio(file) {
    setError("");
    setStatus("");
    setResult(null);

    if (!file) return;

    const allowedExtensions = /\.(wav|mp3|m4a|webm|ogg|mp4)$/i;

    if (!allowedExtensions.test(file.name)) {
      setError("Choose a WAV, MP3, M4A, WEBM, OGG, or MP4 audio file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The audio file must be 20 MB or smaller.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);

    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setPlaying(false);
  }

  async function startRecording() {
    setError("");
    setStatus("");
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Your browser does not support audio recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (blob.size > MAX_FILE_SIZE) {
          setError("This recording exceeds the 20 MB limit.");
          return;
        }
        if (blob.size === 0) {
          setError("No audio was recorded. Please try again.");
          return;
        }

        const extension = mimeType.includes("mp4")
          ? "mp4"
          : mimeType.includes("ogg")
            ? "ogg"
            : "webm";

        const file = new File(
          [blob],
          `voice-recording-${Date.now()}.${extension}`,
          { type: mimeType }
        );

        acceptAudio(file);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in your browser."
          : "Unable to access the microphone. Check that it is connected and available."
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setError("Unable to play this audio file.");
      }
    }
  }

  function handleAudioEnded() {
    setPlaying(false);
  }

  // ── Real AI analysis — POST to Spring Boot, which forwards to Python ──────
  async function requestAnalysis() {
    if (!audioFile) return;

    setError("");
    setStatus("");
    setResult(null);
    setAnalyzing(true);

    const token = localStorage.getItem("voiceguard_token");

    const formData = new FormData();
    formData.append("file", audioFile);

    try {
      const response = await axios.post(
        `${API_BASE}/api/voice/analyze`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          timeout: 120_000, // 2-minute timeout for model inference
        }
      );
      setResult(response.data);
      setStatus("Analysis complete.");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.response?.data ||
        err.message ||
        "Analysis failed.";

      if (err.response?.status === 401) {
        setError("Your session has expired. Please log in again.");
        setTimeout(() => navigate("/login"), 2000);
      } else if (err.response?.status === 503) {
        setError(
          "AI service is unavailable. Make sure the Python server is running on port 8000."
        );
      } else if (err.response?.status === 413) {
        setError("File is too large. Maximum size is 20 MB.");
      } else {
        setError(typeof msg === "string" ? msg : "Analysis failed. Please try again.");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function predictionLabel(prediction) {
    if (prediction === "AI_GENERATED") return "AI-Generated Voice";
    if (prediction === "LIKELY_REAL") return "Likely Real Voice";
    return "Inconclusive";
  }

  function predictionColor(prediction) {
    if (prediction === "AI_GENERATED") return "#ef4444"; // red
    if (prediction === "LIKELY_REAL") return "#22c55e"; // green
    return "#f59e0b"; // amber
  }

  function predictionBg(prediction) {
    if (prediction === "AI_GENERATED") return "rgba(239,68,68,0.12)";
    if (prediction === "LIKELY_REAL") return "rgba(34,197,94,0.12)";
    return "rgba(245,158,11,0.12)";
  }

  return (
    <div className="audio-page">
      <header className="audio-header">
        <button className="back-button" onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={18} />
          Dashboard
        </button>

        <div className="sidebar-brand">
          <AudioWaveform size={26} />
          VoiceGuard AI
        </div>

        <span className="secure-badge">
          <ShieldCheck size={16} />
          Secure workspace
        </span>
      </header>

      <main className="audio-main">
        <p className="eyebrow">VOICE SECURITY / ANALYSIS</p>
        <h1>AI Voice Detection</h1>
        <p className="audio-description">
          Upload a suspicious recording or record a voice sample for
          AI-powered analysis.
        </p>

        <section className="audio-upload-grid">
          <div className="audio-panel">
            <div className="analysis-icon">
              <Upload size={25} />
            </div>

            <h2>Upload audio</h2>
            <p>Select a voice recording from your device.</p>

            <button
              className="upload-dropzone"
              onClick={() => fileInputRef.current?.click()}
              disabled={recording || analyzing}
            >
              <FileAudio size={34} />
              <strong>Choose an audio file</strong>
              <span>WAV, MP3, M4A, WEBM, OGG, MP4</span>
              <span>Maximum size: 20 MB</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.webm,.ogg,.mp4,audio/*"
              hidden
              onChange={(event) => acceptAudio(event.target.files?.[0])}
            />
          </div>

          <div className="audio-panel">
            <div className="analysis-icon">
              <Mic size={25} />
            </div>

            <h2>Record voice</h2>
            <p>Record a sample using your device's microphone.</p>

            <div className="record-area">
              <div className={`record-indicator ${recording ? "is-recording" : ""}`}>
                <Mic size={30} />
              </div>

              {recording ? (
                <>
                  <strong>Recording in progress</strong>
                  <span>Speak clearly into your microphone.</span>
                  <button
                    className="primary-button record-button"
                    onClick={stopRecording}
                  >
                    <Square size={17} />
                    Stop recording
                  </button>
                </>
              ) : (
                <>
                  <strong>Ready to record?</strong>
                  <span>Your browser will ask for microphone permission.</span>
                  <button
                    className="primary-button record-button"
                    onClick={startRecording}
                    disabled={analyzing}
                  >
                    <Mic size={17} />
                    Start recording
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="audio-message error-message">
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {audioFile && (
          <section className="selected-audio">
            <div className="selected-audio-title">
              <div className="analysis-icon">
                <FileAudio size={22} />
              </div>
              <div className="selected-audio-details">
                <strong>{audioFile.name}</strong>
                <span>
                  {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                  {" · "}
                  {audioFile.type || "Audio file"}
                </span>
              </div>
              <CheckCircle2 className="audio-check" size={23} />
            </div>

            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onError={() =>
                setError(
                  "This audio format cannot be previewed by your browser."
                )
              }
              preload="metadata"
            />

            <div className="audio-actions">
              <button
                className="secondary-button"
                onClick={togglePlayback}
                disabled={analyzing}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
                {playing ? "Pause preview" : "Play preview"}
              </button>

              <button
                className="secondary-button remove-button"
                onClick={clearAudio}
                disabled={analyzing}
              >
                <Trash2 size={17} />
                Remove
              </button>
            </div>

            <button
              className="primary-button analyze-button"
              onClick={requestAnalysis}
              disabled={analyzing}
              style={{ opacity: analyzing ? 0.7 : 1 }}
            >
              {analyzing ? (
                <>
                  <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} />
                  Analyzing…
                </>
              ) : (
                <>
                  <Activity size={17} />
                  Analyze with AI
                </>
              )}
            </button>
          </section>
        )}

        {/* ── Result card ─────────────────────────────────────────────── */}
        {result && (
          <section
            className="result-card"
            style={{
              marginTop: "2rem",
              border: `2px solid ${predictionColor(result.prediction)}`,
              borderRadius: "12px",
              padding: "1.5rem",
              background: predictionBg(result.prediction),
            }}
          >
            <h2 style={{ margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Activity size={22} />
              Analysis Result
            </h2>

            {/* Prediction badge */}
            <div
              style={{
                display: "inline-block",
                background: predictionColor(result.prediction),
                color: "#fff",
                fontWeight: 700,
                fontSize: "1.05rem",
                borderRadius: "8px",
                padding: "0.4rem 1rem",
                marginBottom: "1.2rem",
                letterSpacing: "0.02em",
              }}
            >
              {predictionLabel(result.prediction)}
            </div>

            {/* Confidence bar */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                <span>Confidence</span>
                <strong>{result.confidence_percent?.toFixed(1)}%</strong>
              </div>
              <div style={{ height: "10px", background: "rgba(255,255,255,0.15)", borderRadius: "99px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${result.confidence_percent}%`,
                    background: predictionColor(result.prediction),
                    borderRadius: "99px",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
            </div>

            {/* Probability bars */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                <span>Real voice probability</span>
                <strong>{(result.real_probability * 100).toFixed(1)}%</strong>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.15)", borderRadius: "99px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${result.real_probability * 100}%`,
                    background: "#22c55e",
                    borderRadius: "99px",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                <span>AI-generated probability</span>
                <strong>{(result.ai_generated_probability * 100).toFixed(1)}%</strong>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.15)", borderRadius: "99px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${result.ai_generated_probability * 100}%`,
                    background: "#ef4444",
                    borderRadius: "99px",
                  }}
                />
              </div>
            </div>

            {/* Meta grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.6rem 1.5rem",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <span style={{ opacity: 0.65 }}>File</span>
                <div style={{ fontWeight: 600, wordBreak: "break-all" }}>
                  {result.filename || audioFile?.name}
                </div>
              </div>
              <div>
                <span style={{ opacity: 0.65 }}>Duration analyzed</span>
                <div style={{ fontWeight: 600 }}>
                  {result.analyzed_duration_seconds?.toFixed(2)}s
                  {result.audio_was_trimmed && (
                    <span style={{ opacity: 0.65, fontWeight: 400 }}> (trimmed)</span>
                  )}
                </div>
              </div>
              <div>
                <span style={{ opacity: 0.65 }}>Model</span>
                <div style={{ fontWeight: 600, wordBreak: "break-all" }}>
                  {result.model}
                </div>
              </div>
              <div>
                <span style={{ opacity: 0.65 }}>Analyzed</span>
                <div style={{ fontWeight: 600 }}>Just now</div>
              </div>
            </div>

            {/* Disclaimer */}
            <p
              style={{
                margin: 0,
                fontSize: "0.78rem",
                opacity: 0.7,
                fontStyle: "italic",
                borderTop: "1px solid rgba(255,255,255,0.15)",
                paddingTop: "0.75rem",
              }}
            >
              ⚠️ {result.notice || "Experimental prediction. Not proof of authenticity."}
            </p>
          </section>
        )}

        {analyzing && (
          <div className="audio-message success-message" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Sending to AI service… This may take 20–60 seconds on first run.
          </div>
        )}

        {!analyzing && status && !result && (
          <div className="audio-message success-message">{status}</div>
        )}

        <p className="disclaimer" style={{ marginTop: "1.5rem" }}>
          Your audio is sent securely to the backend for analysis.
          Do not upload sensitive or private recordings.
          Results are experimental and not a guarantee of detection accuracy.
        </p>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    </div>
  );
}

export default AudioDetection;


  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [audioUrl]);

  function clearAudio() {
    if (recording && mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setAudioFile(null);
    setAudioUrl("");
    setStatus("");
    setError("");
    setPlaying(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function acceptAudio(file) {
    setError("");
    setStatus("");

    if (!file) return;

    const allowedExtensions = /\.(wav|mp3|m4a|webm|ogg|mp4)$/i;

    if (!allowedExtensions.test(file.name)) {
      setError("Choose a WAV, MP3, M4A, WEBM, OGG, or MP4 audio file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The audio file must be 20 MB or smaller.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);

    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setPlaying(false);
  }

  async function startRecording() {
    setError("");
    setStatus("");

    if (!navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder) {
      setError("Your browser does not support audio recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (blob.size > MAX_FILE_SIZE) {
          setError("This recording exceeds the 20 MB limit.");
          return;
        }

        if (blob.size === 0) {
          setError("No audio was recorded. Please try again.");
          return;
        }

        const extension = mimeType.includes("mp4")
          ? "mp4"
          : mimeType.includes("ogg")
            ? "ogg"
            : "webm";

        const file = new File(
          [blob],
          `voice-recording-${Date.now()}.${extension}`,
          { type: mimeType }
        );

        acceptAudio(file);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in your browser."
          : "Unable to access the microphone. Check that it is connected and available."
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setRecording(false);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setError("Unable to play this audio file.");
      }
    }
  }

  function handleAudioEnded() {
    setPlaying(false);
  }

  function requestAnalysis() {
    setStatus(
      "Audio is ready. AI analysis will be connected in Step 9."
    );
  }

  return (
    <div className="audio-page">
      <header className="audio-header">
        <button
          className="back-button"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={18} />
          Dashboard
        </button>

        <div className="sidebar-brand">
          <AudioWaveform size={26} />
          VoiceGuard AI
        </div>

        <span className="secure-badge">
          <ShieldCheck size={16} />
          Secure workspace
        </span>
      </header>

      <main className="audio-main">
        <p className="eyebrow">VOICE SECURITY / ANALYSIS</p>
        <h1>AI Voice Detection</h1>
        <p className="audio-description">
          Upload a suspicious recording or record a voice sample
          to prepare it for AI-powered analysis.
        </p>

        <section className="audio-upload-grid">
          <div className="audio-panel">
            <div className="analysis-icon">
              <Upload size={25} />
            </div>

            <h2>Upload audio</h2>
            <p>
              Select a voice recording from your device.
            </p>

            <button
              className="upload-dropzone"
              onClick={() => fileInputRef.current?.click()}
              disabled={recording}
            >
              <FileAudio size={34} />
              <strong>Choose an audio file</strong>
              <span>WAV, MP3, M4A, WEBM, OGG, MP4</span>
              <span>Maximum size: 20 MB</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.webm,.ogg,.mp4,audio/*"
              hidden
              onChange={(event) =>
                acceptAudio(event.target.files?.[0])
              }
            />
          </div>

          <div className="audio-panel">
            <div className="analysis-icon">
              <Mic size={25} />
            </div>

            <h2>Record voice</h2>
            <p>
              Record a sample using your device's microphone.
            </p>

            <div className="record-area">
              <div className={`record-indicator ${recording ? "is-recording" : ""}`}>
                <Mic size={30} />
              </div>

              {recording ? (
                <>
                  <strong>Recording in progress</strong>
                  <span>Speak clearly into your microphone.</span>
                  <button
                    className="primary-button record-button"
                    onClick={stopRecording}
                  >
                    <Square size={17} />
                    Stop recording
                  </button>
                </>
              ) : (
                <>
                  <strong>Ready to record?</strong>
                  <span>Your browser will ask for microphone permission.</span>
                  <button
                    className="primary-button record-button"
                    onClick={startRecording}
                  >
                    <Mic size={17} />
                    Start recording
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="audio-message error-message">
            {error}
          </div>
        )}

        {audioFile && (
          <section className="selected-audio">
            <div className="selected-audio-title">
              <div className="analysis-icon">
                <FileAudio size={22} />
              </div>
              <div className="selected-audio-details">
                <strong>{audioFile.name}</strong>
                <span>
                  {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                  {" · "}
                  {audioFile.type || "Audio file"}
                </span>
              </div>
              <CheckCircle2 className="audio-check" size={23} />
            </div>

            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onError={() => setError("This audio format cannot be previewed by your browser.")}
              preload="metadata"
            />

            <div className="audio-actions">
              <button
                className="secondary-button"
                onClick={togglePlayback}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
                {playing ? "Pause preview" : "Play preview"}
              </button>

              <button
                className="secondary-button remove-button"
                onClick={clearAudio}
              >
                <Trash2 size={17} />
                Remove
              </button>
            </div>

            <button
              className="primary-button analyze-button"
              onClick={requestAnalysis}
            >
              Prepare for AI analysis
            </button>
          </section>
        )}

        {status && (
          <div className="audio-message success-message">
            {status}
          </div>
        )}

        <p className="disclaimer">
          Audio stays in this browser for now. The actual AI
          detection service will be connected in the next step.
          Do not upload sensitive recordings during testing.
        </p>
      </main>
    </div>
  );
}

export default AudioDetection;
