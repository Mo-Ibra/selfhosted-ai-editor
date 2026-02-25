import './App.css'
import { AppProvider } from './AppContext'
import AppShell from './components/AppShell'

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}