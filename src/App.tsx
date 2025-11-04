import CommunicationBoardDemo from './components/CommunicationBoardDemo'
import './index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NewBoard from './pages/NewBoard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div className="min-h-screen bg-gray-50">
              <CommunicationBoardDemo />
            </div>
          }
        />
        <Route
          path="/new"
          element={
            <div className="min-h-screen bg-gray-50">
              <NewBoard />
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
