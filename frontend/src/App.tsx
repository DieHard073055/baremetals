import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'

// Admin
import { AccountsPage } from './pages/admin/AccountsPage'
import { VaultsPage } from './pages/admin/VaultsPage'
import { ReportsPage } from './pages/admin/ReportsPage'
import { PricesPage } from './pages/admin/PricesPage'
import { ConfigPage } from './pages/admin/ConfigPage'

// Ops
import { DepositPage } from './pages/ops/DepositPage'
import { WithdrawalPage } from './pages/ops/WithdrawalPage'
import { ClientsPage } from './pages/ops/ClientsPage'
import { OpsVaultsPage } from './pages/ops/OpsVaultsPage'

// Client
import { PortfolioPage } from './pages/client/PortfolioPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<Layout />}>
              <Route path="/admin" element={<AccountsPage />} />
              <Route path="/admin/vaults" element={<VaultsPage />} />
              <Route path="/admin/reports" element={<ReportsPage />} />
              <Route path="/admin/prices" element={<PricesPage />} />
              <Route path="/admin/config" element={<ConfigPage />} />
            </Route>
          </Route>

          {/* Ops routes */}
          <Route element={<ProtectedRoute allowedRoles={['ops']} />}>
            <Route element={<Layout />}>
              <Route path="/ops" element={<Navigate to="/ops/deposit" replace />} />
              <Route path="/ops/deposit" element={<DepositPage />} />
              <Route path="/ops/withdraw" element={<WithdrawalPage />} />
              <Route path="/ops/clients" element={<ClientsPage />} />
              <Route path="/ops/vaults" element={<OpsVaultsPage />} />
            </Route>
          </Route>

          {/* Client routes */}
          <Route element={<ProtectedRoute allowedRoles={['client']} />}>
            <Route element={<Layout />}>
              <Route path="/portfolio" element={<PortfolioPage />} />
            </Route>
          </Route>

          {/* Default */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
