import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  CssBaseline,
  Experimental_CssVarsProvider as CssVarsProvider,
} from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { theme } from "@/theme";
import Layout from "@/components/Layout";
import { ProxyProvider } from "@/contexts/ProxyContext";
import Dashboard from "@/pages/Dashboard";
import CacheManagement from "@/pages/CacheManagement";
import BackendMonitoring from "@/pages/BackendMonitoring";
import ProxyConfig from "@/pages/ProxyConfig";
import BackendConfig from "@/pages/BackendConfig";
import ClusterManagement from "@/pages/ClusterManagement";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CssVarsProvider theme={theme}>
        <CssBaseline />
        <Router>
          <ProxyProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/cache" element={<CacheManagement />} />
                <Route path="/monitoring" element={<BackendMonitoring />} />
                <Route path="/config" element={<ProxyConfig />} />
                <Route path="/backends" element={<BackendConfig />} />
                <Route path="/cluster" element={<ClusterManagement />} />
              </Routes>
            </Layout>
          </ProxyProvider>
        </Router>
      </CssVarsProvider>
    </QueryClientProvider>
  );
}

export default App;
