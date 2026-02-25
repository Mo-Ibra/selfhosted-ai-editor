import { useApp } from "../AppProvider";
import MainLayout from "./MainLayout";
import TitleBar from "./TitleBar";
import WelcomeScreen from "./WelcomeScreen";

function AppShell() {
  const { folderPath } = useApp()

  return (
    <div className="app">
      <TitleBar />
      {folderPath ? <MainLayout /> : <WelcomeScreen />}
    </div>
  )
}

export default AppShell;