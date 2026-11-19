import { setupServer } from 'msw/node'
import { authHandlers } from './handlers/auth'
import { tontinesHandlers } from './handlers/tontines'
import { cyclesHandlers } from './handlers/cycles'
import { cotisationsHandlers } from './handlers/cotisations'
import { membresHandlers } from './handlers/membres'
import { validationHandlers } from './handlers/validation'
import { meHandlers } from './handlers/me'
import { qrHandlers } from './handlers/qr'
import { prioritesHandlers } from './handlers/priorites'
import { notificationsHandlers } from './handlers/notifications'
import { dashboardHandlers } from './handlers/dashboard'
import { codeListHandlers } from './handlers/codeList'
import { usersHandlers } from './handlers/users'
import { publicConfigHandlers } from './handlers/publicConfig'

export const server = setupServer(
  ...authHandlers,
  ...tontinesHandlers,
  ...cyclesHandlers,
  ...cotisationsHandlers,
  ...membresHandlers,
  ...validationHandlers,
  ...meHandlers,
  ...qrHandlers,
  ...prioritesHandlers,
  ...notificationsHandlers,
  ...dashboardHandlers,
  ...codeListHandlers,
  ...usersHandlers,
  ...publicConfigHandlers,
)
