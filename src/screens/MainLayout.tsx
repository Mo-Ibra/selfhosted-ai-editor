import { useCallback, useState, useEffect } from "react";
import ChatPane from "../components/ChatPane";
import EditorPane from "../components/EditorPane";
import Sidebar from "../components/Sidebar";
import { useApp } from "../AppProvider";

function MainLayout() {
  const { settings, updateSetting } = useApp();
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startResizingChat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingChat(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingChat(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(160, Math.min(600, e.clientX));
      updateSetting("sidebarWidth", newWidth);
    } else if (isResizingChat) {
      const containerWidth = window.innerWidth;
      const newWidth = Math.max(200, Math.min(800, containerWidth - e.clientX));
      updateSetting("chatWidth", newWidth);
    }
  }, [isResizingSidebar, isResizingChat, updateSetting]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => resize(e);
    const handleMouseUp = () => stopResizing();

    if (isResizingSidebar || isResizingChat) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar, isResizingChat, resize, stopResizing]);

  return (
    <div className={`main-layout ${isResizingSidebar || isResizingChat ? 'resizing' : ''}`}>
      {/* Sidebar */}
      <div 
        className={`sidebar-container ${!settings.showSidebar ? 'hidden' : ''}`} 
        style={{ width: settings.showSidebar ? settings.sidebarWidth : 0 }}
      >
        <Sidebar />
      </div>
      
      {/* Sidebar Handle */}
      {settings.showSidebar && (
        <div 
          className={`resize-handle sidebar-handle ${isResizingSidebar ? 'active' : ''}`} 
          onMouseDown={startResizingSidebar}
        />
      )}

      {/* Editor (Stretches) */}
      <EditorPane />

      {/* Chat Handle */}
      {settings.showChat && (
        <div 
          className={`resize-handle chat-handle ${isResizingChat ? 'active' : ''}`} 
          onMouseDown={startResizingChat}
        />
      )}

      {/* Chat */}
      <div 
        className={`chat-container ${!settings.showChat ? 'hidden' : ''}`}
        style={{ width: settings.showChat ? settings.chatWidth : 0 }}
      >
        <ChatPane />
      </div>
    </div>
  );
}

export default MainLayout;