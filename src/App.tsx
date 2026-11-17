import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import Manage from '@/pages/Manage'
import NotFound from '@/pages/NotFound'
import Review from '@/pages/Review'
import Share from '@/pages/Share'
import Story from '@/pages/Story'
import { capturePin } from '@/lib/pin'

// Remember a pin id from the landing URL before the first render, so the footer link already carries it.
capturePin()

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/share" element={<Share />} />
        <Route path="/review" element={<Review />} />
        <Route path="/stories/:id" element={<Story />} />
        <Route path="/manage/:token" element={<Manage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
