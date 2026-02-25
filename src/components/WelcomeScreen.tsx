import { useApp } from "../AppContext";

function WelcomeScreen() {
  const { openFolder } = useApp()

  return (
    <div className="welcome-screen">
      <div className="welcome-icon">⚡</div>
      <h1>AI Editor</h1>
      <p>Open a project folder to start editing with AI assistance powered by Ollama.</p>
      <button className="btn-primary" onClick={openFolder}>
        📂 Open Folder
      </button>
    </div>
  )
}

export default WelcomeScreen;