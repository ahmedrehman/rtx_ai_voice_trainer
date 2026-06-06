import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Archive, Database, FileAudio, Home, Menu, Mic, Server, Volume2, X } from "lucide-react";
import "./styles.css";

type Page = {
  id: string;
  label: string;
  module: "Start" | "Client Voice" | "Server AI Voice" | "Data Store" | "Debug";
  role: string;
  icon: React.ComponentType<{ size?: number }>;
};

const pages: Page[] = [
  { id: "start", label: "Start", module: "Start", role: "empty start page", icon: Home },
  { id: "debug", label: "Debug", module: "Debug", role: "debug item array display", icon: Activity },
  { id: "SYSTEM_MEANINGFUL_AUDIO_CHUNK", label: "Meaningful Audio Chunk", module: "Client Voice", role: "microphone audio chunk creator/checker", icon: Mic },
  { id: "SYSTEM_MICRO_TO_AUDIO", label: "Micro To Audio", module: "Client Voice", role: "browser microphone to audio blob", icon: Mic },
  { id: "SYSTEM_AUDIO_TO_TEXT", label: "Audio To Text", module: "Client Voice", role: "browser speech recognition checker", icon: FileAudio },
  { id: "SYSTEM_TEXT_TO_AUDIO", label: "Text To Audio", module: "Client Voice", role: "browser dummy speech output", icon: Volume2 },
  { id: "SYSTEM_AUDIO_TO_SPEAKER", label: "Audio To Speaker", module: "Client Voice", role: "audio blob playback", icon: Volume2 },
  { id: "PRIMITIVE_TEXT_TO_AUDIO", label: "Primitive Text To Audio", module: "Server AI Voice", role: "server text to AI audio", icon: Server },
  { id: "PRIMITIVE_AUDIO_TO_TEXT", label: "Primitive Audio To Text", module: "Server AI Voice", role: "server audio to transcript", icon: Server },
  { id: "AUDIO_TO_AI_TEXT_AND_AUDIO", label: "Audio To AI Text And Audio", module: "Server AI Voice", role: "original audio to AI text and AI audio", icon: Server },
  { id: "AUDIO_ANALYSER", label: "Audio Analyser", module: "Server AI Voice", role: "real audio analysis method", icon: Server },
  { id: "DATA_STORE_SAVE_EVENT", label: "Save Event", module: "Data Store", role: "store debug/history/error event", icon: Database },
  { id: "DATA_STORE_LIST_EVENTS", label: "List Events", module: "Data Store", role: "read event array", icon: Database },
  { id: "DATA_STORE_CLEAR_EVENTS", label: "Clear Events", module: "Data Store", role: "clear event records", icon: Archive },
  { id: "DATA_STORE_SAVE_COST", label: "Save Cost", module: "Data Store", role: "store cost/payment record", icon: Database },
  { id: "DATA_STORE_LIST_COSTS", label: "List Costs", module: "Data Store", role: "read cost/payment records", icon: Database },
  { id: "DATA_STORE_RESET_COSTS", label: "Reset Costs", module: "Data Store", role: "clear cost/payment records", icon: Archive }
];

function App() {
  const [activePageId, setActivePageId] = useState("start");
  const [menuOpen, setMenuOpen] = useState(false);
  const activePage = pages.find((page) => page.id === activePageId) || pages[0];
  const groups = useMemo(() => {
    return pages.reduce<Record<string, Page[]>>((result, page) => {
      result[page.module] = [...(result[page.module] || []), page];
      return result;
    }, {});
  }, []);

  function selectPage(pageId: string) {
    setActivePageId(pageId);
    setMenuOpen(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <div className="brand-mark">
          <span className="brand-dot" />
          <div>
            <strong>AI Voice Trainer</strong>
            <small>{activePage.module}</small>
          </div>
        </div>
      </header>

      <div className={menuOpen ? "scrim open" : "scrim"} onClick={() => setMenuOpen(false)} />

      <aside className={menuOpen ? "nav-panel open" : "nav-panel"} aria-label="Page navigation">
        <div className="nav-head">
          <div>
            <strong>Modules</strong>
            <small>Function pages</small>
          </div>
          <button className="close-button" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="nav-list">
          {Object.entries(groups).map(([group, items]) => (
            <section key={group}>
              <h2>{group}</h2>
              {items.map((page) => {
                const Icon = page.icon;
                return (
                  <button key={page.id} className={page.id === activePage.id ? "active" : ""} onClick={() => selectPage(page.id)}>
                    <Icon size={17} />
                    <span>{page.label}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <PageView page={activePage} />
      </section>
    </main>
  );
}

function PageView({ page }: { page: Page }) {
  const Icon = page.icon;
  return (
    <article className="page">
      <div className="page-kicker">
        <Icon size={18} />
        <span>{page.module}</span>
      </div>
      <h1>{page.label}</h1>
      <p>{page.role}</p>
      <div className="empty-panel">
        <span>Empty page</span>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
