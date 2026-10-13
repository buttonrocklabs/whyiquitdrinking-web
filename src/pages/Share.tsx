import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'
import ShareFlow from '@/components/share/ShareFlow'

export default function Share() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <ShareFlow />
      </main>
      <Footer />
    </div>
  )
}
