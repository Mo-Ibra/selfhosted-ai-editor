import ChatPane from "../components/ChatPane";
import EditorPane from "../components/EditorPane";
import Sidebar from "../components/Sidebar";

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