import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Landing } from "@/pages/Landing"

const Components = lazy(() => import("@/pages/Components").then((m) => ({ default: m.Components })))

function ScrollToHash() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={200}>
        <ScrollToHash />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/components" element={<Suspense fallback={null}><Components /></Suspense>} />
        </Routes>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </BrowserRouter>
  )
}
