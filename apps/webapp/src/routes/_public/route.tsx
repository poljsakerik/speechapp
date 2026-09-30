import { createFileRoute, Outlet } from "@tanstack/react-router"

import { SiteNav } from "@/components/site/SiteNav"

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <>
      <SiteNav />
      <Outlet />
    </>
  )
}
