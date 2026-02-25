import { useApp } from "../AppProvider";
import AIChat from "./AIChat";

function ChatPane() {
  const {
    messages, isStreaming, aiModel, selectedCode,
    acceptedEdits, rejectedEdits,
    sendMessage, acceptEdit, rejectEdit,
  } = useApp()

  return (
    <AIChat
      messages={messages}
      isStreaming={isStreaming}
      onSend={sendMessage}
      onAcceptEdit={acceptEdit}
      onRejectEdit={rejectEdit}
      acceptedEdits={acceptedEdits}
      rejectedEdits={rejectedEdits}
      aiModel={aiModel}
      selectedCode={selectedCode}
    />
  )
}

export default ChatPane;