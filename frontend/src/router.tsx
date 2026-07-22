import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AppHeader } from './ui/AppHeader'
import { AuthPage } from './views/AuthPage'
import { HomePage } from './views/HomePage'
import { RoomPage } from './views/RoomPage'
import { NotFoundPage } from './views/NotFoundPage'
import { SettingsPage } from './views/SettingsPage'
import { FirstPasswordPage } from './views/FirstPasswordPage'
import { IncomingCall } from './ui/IncomingCall'

type RouterContext = { queryClient: QueryClient }

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div className="min-h-dvh">
      <AppHeader />
      <Outlet />
      <IncomingCall />
    </div>
  ),
  notFoundComponent: NotFoundPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: AuthPage,
})

const firstPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/first-password',
  component: FirstPasswordPage,
})

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/r/$inviteCode',
  component: RoomPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, firstPasswordRoute, roomRoute, settingsRoute])

export const router = createRouter({ routeTree, context: { queryClient: undefined! } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
