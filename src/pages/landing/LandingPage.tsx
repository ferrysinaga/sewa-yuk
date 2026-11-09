import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import HeroSection from './sections/HeroSection'
import LandingFooter from './sections/LandingFooter'
import LandingHeader from './sections/LandingHeader'
import RolesSection from './sections/RolesSection'

export default function LandingPage() {
  useDocumentTitle('Beranda')

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[6px] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lewati ke konten utama
      </a>

      <LandingHeader />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        <HeroSection />
        <RolesSection />
      </main>

      <LandingFooter />
    </div>
  )
}
