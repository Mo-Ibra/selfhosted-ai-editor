import ChatPane from "./ChatPane";
import EditorPane from "./EditorPane";
import Sidebar from "./Sidebar";

function MainLayout() {
  return (
    <div className="main-layout">
      <Sidebar />
      <EditorPane />
      <ChatPane />
    </div>
  )
}

export default MainLayout;