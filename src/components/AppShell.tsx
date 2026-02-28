import { useApp } from "../AppProvider";
import MainLayout from "./MainLayout";
import MenuBar from "./MenuBar";
import TitleBar from "./TitleBar";
import WelcomeScreen from "./WelcomeScreen";

function AppShell() {
  const { folderPath } = useApp()

  return (
    <div className="app">
      <TitleBar />
      <MenuBar />
      {folderPath ? <MainLayout /> : <WelcomeScreen />}
    </div>
  )
}

export default AppShell;
