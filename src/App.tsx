import './App.css'
import { AppProvider } from './AppProvider'
import AppShell from './screens/AppShell'

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}