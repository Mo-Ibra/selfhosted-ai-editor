import { useApp } from "../AppProvider";
import AIChat from "./AIChat";

function ChatPane() {
  const {
    messages, isStreaming, aiModel, selectedCode,
    acceptedEdits, rejectedEdits,
    webSearch, setWebSearch,
    sendMessage, acceptEdit, rejectEdit, stopChat
  } = useApp()

  return (
    <AIChat
      messages={messages}
      isStreaming={isStreaming}
      onSend={sendMessage}
      onAcceptEdit={acceptEdit}
      onRejectEdit={rejectEdit}
      onStop={stopChat}
      acceptedEdits={acceptedEdits}
      rejectedEdits={rejectedEdits}
      aiModel={aiModel}
      selectedCode={selectedCode}
      webSearch={webSearch}
      setWebSearch={setWebSearch}
    />
  )
}

export default ChatPane;