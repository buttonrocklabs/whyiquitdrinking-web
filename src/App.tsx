import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import NotFound from '@/pages/NotFound'
import Review from '@/pages/Review'
import Share from '@/pages/Share'
import Story from '@/pages/Story'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/share" element={<Share />} />
        <Route path="/review" element={<Review />} />
        <Route path="/stories/:id" element={<Story />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
