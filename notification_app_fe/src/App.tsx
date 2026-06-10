import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import Navbar from './components/Navbar'
import AllNotifications from './pages/AllNotifications'
import PriorityInbox from './pages/PriorityInbox'

const theme = createTheme({
  palette: {
    primary: { main: '#1a1a2e' },
    background: { default: '#f5f5f5' }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif'
  }
})

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<AllNotifications />} />
          <Route path="/priority" element={<PriorityInbox />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
